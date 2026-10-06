"use client";

import { useEffect } from "react";
import { registrarVisita } from "@/app/[slug]/actions";

// Cuenta la visita al menú una vez por día (hora de Venezuela) en este navegador. Corre después de cargar la
// página, así que los bots y las vistas previas de enlaces (que no ejecutan JavaScript) no cuentan.
export function ContarVisita({ slug }: { slug: string }) {
  useEffect(() => {
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
    const clave = `visita:${slug}:${hoy}`;
    try {
      if (localStorage.getItem(clave)) return;
      localStorage.setItem(clave, "1");
    } catch {
      // Sin almacenamiento (modo privado estricto): se cuenta igual, una vez por carga.
    }
    void registrarVisita(slug);
  }, [slug]);
  return null;
}
