import Link from "next/link";
import type { ReactNode } from "react";
import { Icono, type NombreIcono } from "@/components/iconos";
import { BarrasDiarias } from "@/components/superadmin/barras-diarias";
import { botonSecundario, tiempoLegible } from "@/components/superadmin/locales";
import { EncabezadoPagina, tarjetaSa } from "@/components/superadmin/marco";
import { requerirSuperadmin } from "@/lib/admin";
import { fechaCorta } from "@/lib/fechas";
import { cargarMetricas, conversion, leerPeriodo, PERIODOS } from "@/lib/metricas";
import { formatUsd } from "@/lib/precios";

export const metadata = { title: "Super admin — Analíticas" };

const pct = (v: number | null) => (v === null ? null : `${v.toFixed(1).replace(".", ",")}%`);

function Cifra({ titulo, icono, valor, pie }: { titulo: string; icono: NombreIcono; valor: string | null; pie: ReactNode }) {
  return (
    <div className={`${tarjetaSa} p-4 lg:p-5`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase">{titulo}</span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-(--acento-texto)"><Icono nombre={icono} tamano={18} /></span>
      </div>
      <p className={`mt-3 font-titulo text-[26px] leading-8 font-bold tracking-tight ${valor === null ? "text-[18px]! font-semibold text-muted" : ""}`}>{valor ?? "Sin datos aún"}</p>
      <p className="mt-1 text-xs text-muted">{pie}</p>
    </div>
  );
}

export default async function Analiticas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requerirSuperadmin();
  const dias = leerPeriodo((await searchParams).dias);
  const m = await cargarMetricas(supabase, dias);
  const anio = m.hasta.slice(0, 4);
  const filas = [...m.locales].sort((a, b) => b.pedidos - a.pedidos || b.visitas - a.visitas || a.nombre.localeCompare(b.nombre));

  return (
    <>
      <EncabezadoPagina
        titulo="Analíticas"
        etiqueta={`${fechaCorta(m.desde, anio)} – ${fechaCorta(m.hasta, anio)}`}
        descripcion="Visitas al menú, pedidos por WhatsApp, ventas y tiempo de respuesta del asistente, de todos los locales."
        acciones={
          <>
            <nav aria-label="Periodo" className="flex items-center gap-1 rounded-xl bg-surface p-1">
              {PERIODOS.map((p) => (
                <Link
                  key={p}
                  href={`/superadmin/analiticas?dias=${p}`}
                  aria-current={p === dias ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold ${p === dias ? "bg-card text-(--acento-texto) shadow-(--sombra-1)" : "text-muted hover:text-foreground"}`}
                >
                  {p} días
                </Link>
              ))}
            </nav>
            <Link href={`/superadmin/reporte?dias=${dias}`} prefetch={false} className={botonSecundario}>
              <Icono nombre="descarga" tamano={18} />
              Reporte
            </Link>
          </>
        }
      />

      {m.incompleto && (
        <p role="status" className="mb-6 rounded-xl bg-aviso-suave px-4 py-3 text-sm text-aviso">
          Algunas métricas no se pudieron cargar. Recarga la página en un momento.
        </p>
      )}

      <section aria-label="Totales del periodo" className="mb-7 grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-5">
        <Cifra titulo="Visitas al menú" icono="ojo" valor={String(m.totales.visitas)} pie="Una por navegador, por día y por local" />
        <Cifra titulo="Pedidos WhatsApp" icono="enviar" valor={String(m.totales.pedidos)} pie="Registrados por el asistente" />
        <Cifra titulo="Conversión" icono="flecha" valor={pct(conversion(m.totales.pedidos, m.totales.visitas))} pie="Pedidos por cada 100 visitas" />
        <Cifra titulo="Ventas" icono="grafica" valor={formatUsd(m.totales.ventas_usd)} pie="Pedidos confirmados en adelante" />
        <Cifra titulo="Respuesta típica" icono="reloj" valor={tiempoLegible(m.totales.respuesta_mediana_s)} pie={m.totales.respuestas ? `Mediana de ${m.totales.respuestas} respuestas del asistente` : "El asistente aún no ha respondido en este periodo"} />
      </section>

      <section aria-label="Por día" className={`${tarjetaSa} mb-7 grid gap-8 p-5 lg:grid-cols-2 lg:p-6`}>
        <BarrasDiarias titulo="Visitas por día" serie={m.serie.map((d) => ({ dia: d.dia, valor: d.visitas }))} />
        <BarrasDiarias titulo="Pedidos por día" tono="exito" serie={m.serie.map((d) => ({ dia: d.dia, valor: d.pedidos }))} />
      </section>

      <section aria-labelledby="por-local" className={`${tarjetaSa} p-5 lg:p-6`}>
        <h2 id="por-local" className="text-[16px] font-semibold">Por local</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] tracking-[0.04em] text-muted uppercase">
                <th className="pb-2.5 font-semibold">Local</th>
                <th className="pb-2.5 text-right font-semibold">Visitas</th>
                <th className="pb-2.5 text-right font-semibold">Pedidos</th>
                <th className="pb-2.5 text-right font-semibold">Conversión</th>
                <th className="pb-2.5 text-right font-semibold">Ventas</th>
                <th className="pb-2.5 text-right font-semibold">Respuesta</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((l) => (
                <tr key={l.id} data-fila-local={l.slug} className="border-t border-line">
                  <td className="py-3 pr-3">
                    <Link href={`/superadmin/locales/${l.slug}`} className="font-semibold hover:text-(--acento-texto)">{l.nombre}</Link>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${l.activo ? "bg-exito-suave text-exito" : "bg-aviso-suave text-aviso"}`}>{l.activo ? "Activo" : "Pausado"}</span>
                  </td>
                  <td className="py-3 text-right">{l.visitas}</td>
                  <td className="py-3 text-right">{l.pedidos}</td>
                  <td className="py-3 text-right text-muted">{pct(conversion(l.pedidos, l.visitas)) ?? "—"}</td>
                  <td className="py-3 text-right">{formatUsd(l.ventas_usd)}</td>
                  <td className="py-3 text-right text-muted">{tiempoLegible(l.respuesta_mediana_s) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-muted">
          Las visitas y el tiempo de respuesta se cuentan desde que se activaron estas métricas; los pedidos y las ventas traen su historia completa.
        </p>
      </section>
    </>
  );
}
