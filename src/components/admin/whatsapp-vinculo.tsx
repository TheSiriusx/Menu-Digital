"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { consultarWhatsApp, pedirQR, type EstadoVinculo } from "@/app/admin/whatsapp/actions";

const ESTADOS = {
  conectado: { texto: "Conectado", clase: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  conectando: { texto: "Conectando…", clase: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  desconectado: { texto: "Desconectado", clase: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  desconocido: { texto: "Estado desconocido", clase: "bg-surface text-muted" },
  sin_instancia: { texto: "Sin cuenta de WhatsApp", clase: "bg-surface text-muted" },
  no_configurado: { texto: "No configurado", clase: "bg-surface text-muted" },
} as const;

const CADA_CONSULTA_MS = 6000; // estado, con la pantalla abierta
const CADA_CONSULTA_QR_MS = 3000; // estado, mientras se escanea
const RENOVAR_QR_MS = 25000; // el QR caduca a los pocos segundos: se pide otro solo

// Muestra si el WhatsApp del local está vinculado y deja (re)vincularlo escaneando un QR, sin ayuda de nadie.
export function WhatsAppVinculo({ negocioId }: { negocioId: string }) {
  const [vinculo, setVinculo] = useState<EstadoVinculo | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [qr, setQr] = useState<{ imagen: string | null; codigo: string | null } | null>(null);
  const [cargando, setCargando] = useState(false);
  const consultando = useRef(false); // el sondeo del estado no se solapa consigo mismo
  const renovando = useRef(false); // ni la renovación del QR: pero una no bloquea a la otra

  const datos = useCallback(() => {
    const d = new FormData();
    d.append("negocio", negocioId);
    return d;
  }, [negocioId]);

  const consultar = useCallback(async () => {
    if (consultando.current || renovando.current || document.visibilityState === "hidden") return;
    consultando.current = true;
    try {
      const r = await consultarWhatsApp(datos());
      setVinculo(r);
      if (r.estado === "conectado") {
        setEscaneando(false);
        setQr(null);
      }
    } catch {
      // Sin red o la página se está cerrando: se reintenta en el próximo ciclo, sin dejar un error suelto.
    } finally {
      consultando.current = false;
    }
  }, [datos]);

  const renovarQR = useCallback(async () => {
    if (renovando.current) return;
    renovando.current = true;
    setCargando(true);
    try {
      const r = await pedirQR(datos());
      setVinculo(r);
      if (r.estado === "conectado") {
        setEscaneando(false);
        setQr(null);
      } else {
        setQr({ imagen: r.qr ?? null, codigo: r.codigo ?? null });
      }
    } catch {
      // Igual: el QR se vuelve a pedir en el próximo ciclo.
    } finally {
      renovando.current = false;
      setCargando(false);
    }
  }, [datos]);

  // Estado al abrir y cada pocos segundos mientras la pantalla está a la vista.
  useEffect(() => {
    const primera = setTimeout(() => void consultar(), 0);
    const t = setInterval(() => void consultar(), escaneando ? CADA_CONSULTA_QR_MS : CADA_CONSULTA_MS);
    return () => {
      clearTimeout(primera);
      clearInterval(t);
    };
  }, [consultar, escaneando]);

  // Mientras se escanea, el QR se renueva solo.
  useEffect(() => {
    if (!escaneando) return;
    const t = setInterval(() => void renovarQR(), RENOVAR_QR_MS);
    return () => clearInterval(t);
  }, [escaneando, renovarQR]);

  const estado = vinculo?.estado ?? "desconocido";
  const etiqueta = ESTADOS[estado];
  const puedeVincular = estado === "desconectado" || estado === "desconocido" || estado === "conectando";

  function empezar() {
    setEscaneando(true);
    void renovarQR();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span data-estado-whatsapp={estado} className={`rounded-full px-3 py-1 text-sm font-medium ${etiqueta.clase}`}>
          {vinculo ? etiqueta.texto : "Consultando…"}
        </span>
        {puedeVincular && vinculo?.ok !== false && !escaneando && (
          <button
            type="button"
            onClick={empezar}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            {estado === "desconectado" ? "Reescanear WhatsApp" : "Vincular WhatsApp"}
          </button>
        )}
        {escaneando && (
          <button
            type="button"
            onClick={() => {
              setEscaneando(false);
              setQr(null);
            }}
            className="rounded-full border border-line px-4 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
        )}
      </div>

      {estado === "conectado" && (
        <p role="status" className="mt-3 text-sm text-muted">
          Tu WhatsApp está vinculado: el asistente ya puede recibir y atender pedidos.
        </p>
      )}
      {estado === "sin_instancia" && (
        <p className="mt-3 text-sm text-muted">
          Este local todavía no tiene su cuenta de WhatsApp creada. Escríbele a Starck Labs para activarla.
        </p>
      )}
      {vinculo?.ok === false && vinculo.error && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {vinculo.error}
        </p>
      )}

      {escaneando && (
        <div className="mt-4 space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>En el teléfono del local abre WhatsApp.</li>
            <li>Ve a <strong>Ajustes → Dispositivos vinculados → Vincular un dispositivo</strong>.</li>
            <li>Escanea este código. Se renueva solo si tarda.</li>
          </ol>
          {qr?.imagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr.imagen}
              alt="Código QR para vincular WhatsApp"
              width={260}
              height={260}
              className="h-64 w-64 rounded-xl border border-line bg-white p-2"
            />
          ) : (
            <p className="text-sm text-muted">{cargando ? "Generando el código…" : "Esperando el código…"}</p>
          )}
          {qr?.codigo && (
            <p className="text-sm">
              O escribe este código en el teléfono: <strong className="font-mono tracking-wider">{qr.codigo}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
