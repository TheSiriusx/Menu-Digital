"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Pidelo como app instalable:
//  · Registra el service worker (public/sw.js) solo en producción, con updateViaCache "none" para que el navegador
//    siempre pida el sw.js nuevo en vez de usar uno guardado.
//  · Cuando la app vuelve al frente después de un rato (el dueño la tenía minimizada), recarga los datos de la
//    pantalla: pedidos nuevos, estados, stock. De paso busca si hay una versión nueva del service worker.
const RECARGAR_TRAS_MS = 30_000;

export function RegistroPWA() {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Sin service worker la app sigue funcionando; solo no tendrá página sin conexión.
      });
    }

    let ocultaDesde = 0;
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "hidden") {
        ocultaDesde = Date.now();
        return;
      }
      if (ocultaDesde && Date.now() - ocultaDesde > RECARGAR_TRAS_MS) {
        router.refresh();
        navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
      }
      ocultaDesde = 0;
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => document.removeEventListener("visibilitychange", alCambiarVisibilidad);
  }, [router]);

  return null;
}
