import { requerirSuperadmin } from "@/lib/admin";
import { hoyCaracas } from "@/lib/fechas";
import { cargarMetricas, conversion, leerPeriodo } from "@/lib/metricas";
import { etiquetaPlan, etiquetaTipo } from "@/lib/tipos";

// Descarga «Reporte»: los locales con sus métricas del periodo, en CSV (se abre en Excel o Google Sheets).
// Solo con sesión de super admin (con su segundo factor): requerirSuperadmin redirige a cualquier otro.
export async function GET(request: Request) {
  const { supabase } = await requerirSuperadmin();
  const dias = leerPeriodo(new URL(request.url).searchParams.get("dias"));
  const m = await cargarMetricas(supabase, dias);

  // Una celda que empiece por = + - @ la tomaría Excel como fórmula: se antepone un apóstrofo.
  const celda = (v: unknown) => {
    let t = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const numero = (n: number | null, decimales = 0) => (n === null ? "" : n.toFixed(decimales));
  const filas = [
    ["Local", "Enlace", "Tipo", "Plan", "Estado", "Productos", "Dueños", "WhatsApp", `Visitas (${dias} días)`, `Pedidos (${dias} días)`, "Conversión (%)", "Ventas (USD)", "Respuesta típica (s)"],
    ...m.locales.map((l) => [
      l.nombre, `/${l.slug}`, etiquetaTipo(l.tipo), etiquetaPlan(l.plan), l.activo ? "Activo" : "Pausado", l.productos,
      l.duenos.join(" / "), l.instancia ?? "Pendiente", l.visitas, l.pedidos, numero(conversion(l.pedidos, l.visitas), 1),
      numero(l.ventas_usd, 2), numero(l.respuesta_mediana_s),
    ]),
  ];
  const csv = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n") + "\r\n";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pidelo-locales-${hoyCaracas()}-${dias}d.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
