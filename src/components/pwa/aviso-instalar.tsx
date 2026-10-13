"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

// Cartel para instalar Pidelo como app. No se muestra si ya está instalada (se abrió como app).
//  · Android y computadora (Chrome, Edge): botón «Instalar», con el aviso nativo del navegador.
//  · iPhone y iPad: no existe ese botón; se explica Compartir → «Agregar a inicio».
//  · Navegador interno de Instagram, Facebook, WhatsApp, TikTok…: ahí no se puede instalar; se pide abrir el
//    enlace en Safari o Chrome.
// Si el dueño lo cierra, no vuelve a salir en ese navegador.

type Entorno = "instalada" | "app-ajena" | "ios" | "otro";
type EventoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const CLAVE = "pidelo-aviso-instalar-cerrado";
const APP_AJENA = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|musical_ly|TikTok|Twitter|LinkedInApp|Pinterest/i;

function entornoActual(): Entorno {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (matchMedia("(display-mode: standalone)").matches || nav.standalone === true) return "instalada";
  if (APP_AJENA.test(nav.userAgent)) return "app-ajena";
  if (/iPhone|iPad|iPod/i.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1)) return "ios";
  return "otro";
}

function cerradoAntes(): boolean {
  try {
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

const sinSuscripcion = () => () => {};

export function AvisoInstalar({ className = "" }: { className?: string }) {
  // En el servidor no hay navegador: el cartel se decide al cargar en el teléfono (null = todavía no se sabe).
  const entorno = useSyncExternalStore(sinSuscripcion, entornoActual, () => null);
  const cerradoGuardado = useSyncExternalStore(sinSuscripcion, cerradoAntes, () => true);
  const [cerrado, setCerrado] = useState(false);
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const alOfrecer = (e: Event) => {
      e.preventDefault(); // el navegador espera a que el dueño toque «Instalar»
      setEvento(e as EventoInstalar);
    };
    const alInstalar = () => setEvento(null);
    window.addEventListener("beforeinstallprompt", alOfrecer);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alOfrecer);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  const cerrar = () => {
    setCerrado(true);
    try {
      localStorage.setItem(CLAVE, "1");
    } catch {
      // Sin almacenamiento (navegación privada): se cierra solo por ahora.
    }
  };

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  if (!entorno || entorno === "instalada" || cerrado || cerradoGuardado) return null;
  if (entorno === "otro" && !evento) return null;

  let texto: ReactNode;
  let accion: ReactNode = null;
  if (entorno === "app-ajena") {
    texto = <>Estás en el navegador de otra app y desde aquí no se puede instalar Pidelo. Abre este enlace en <b>Safari</b> (iPhone) o <b>Chrome</b> (Android).</>;
    accion = (
      <button type="button" onClick={copiarEnlace} className="min-h-11 rounded-brand-sm bg-brand px-4 text-[13px] font-bold text-accent">
        {copiado ? "Enlace copiado" : "Copiar enlace"}
      </button>
    );
  } else if (entorno === "ios") {
    texto = (
      <>
        Instala Pidelo en tu iPhone: toca <b>Compartir</b> (el cuadrado con la flecha hacia arriba) y luego <b>Agregar a inicio</b>. La app no
        comparte la sesión con Safari: vuelve a entrar con tu correo dentro de la app.
      </>
    );
  } else {
    texto = <>Instala Pidelo en este dispositivo y ábrelo como una app, sin pasar por la tienda.</>;
    accion = (
      <button
        type="button"
        onClick={async () => {
          await evento?.prompt();
          setEvento(null);
        }}
        className="min-h-11 rounded-brand-sm bg-brand px-4 text-[13px] font-bold text-accent"
      >
        Instalar
      </button>
    );
  }

  return (
    <section aria-label="Instalar Pidelo" className={`flex items-start gap-3 rounded-brand-sm border border-line bg-surface-200 p-3 text-[13.5px] text-ink ${className}`}>
      <Logo variant="isotipo" width={28} alt="" className="-m-1" />
      <div className="min-w-0 flex-1">
        <p>{texto}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {accion}
          <button type="button" onClick={cerrar} className="min-h-11 rounded-[10px] px-3 text-[13px] font-semibold text-ink-muted hover:text-ink">
            Ahora no
          </button>
        </div>
      </div>
    </section>
  );
}
