"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { leerCarrito, MAX_POR_PRODUCTO } from "@/lib/pedido";

// Carrito por local, recordado en el navegador. Si localStorage no está disponible (modo
// privado, bloqueado) sigue funcionando en memoria, solo que no se recuerda al recargar.

const memoria = new Map<string, string>(); // JSON del carrito por clave, fuente de verdad en la sesión
const oyentes = new Set<() => void>();

function avisar() {
  oyentes.forEach((oyente) => oyente());
}

function leerRaw(clave: string): string {
  const guardado = memoria.get(clave);
  if (guardado !== undefined) return guardado;
  let raw = "";
  try {
    raw = localStorage.getItem(clave) ?? "";
  } catch {
    // sin almacenamiento
  }
  memoria.set(clave, raw);
  return raw;
}

function escribirRaw(clave: string, raw: string) {
  memoria.set(clave, raw);
  try {
    if (raw) localStorage.setItem(clave, raw);
    else localStorage.removeItem(clave);
  } catch {
    // sin almacenamiento: queda solo en memoria
  }
  avisar();
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  // Cambios hechos desde otra pestaña: se descarta lo recordado y se vuelve a leer.
  const enOtraPestana = () => {
    memoria.clear();
    oyente();
  };
  window.addEventListener("storage", enOtraPestana);
  return () => {
    oyentes.delete(oyente);
    window.removeEventListener("storage", enOtraPestana);
  };
}

export function useCarrito(slug: string) {
  const clave = `carrito:${slug}`;

  // En el servidor (y en el primer render del cliente) el carrito está vacío, así el HTML coincide.
  const raw = useSyncExternalStore(
    suscribir,
    () => leerRaw(clave),
    () => "",
  );
  const carrito = useMemo(() => leerCarrito(raw), [raw]);

  const cambiar = useCallback(
    (productoId: string, delta: number) => {
      const siguiente = leerCarrito(leerRaw(clave));
      const cantidad = Math.min(MAX_POR_PRODUCTO, Math.max(0, (siguiente[productoId] ?? 0) + delta));
      if (cantidad > 0) siguiente[productoId] = cantidad;
      else delete siguiente[productoId];
      escribirRaw(clave, Object.keys(siguiente).length > 0 ? JSON.stringify(siguiente) : "");
    },
    [clave],
  );

  const vaciar = useCallback(() => escribirRaw(clave, ""), [clave]);

  return { carrito, cambiar, vaciar };
}
