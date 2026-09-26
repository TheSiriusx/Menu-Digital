import Link from "next/link";
import { AvisoPausa, tarjeta, Titulo, type Contexto } from "@/components/admin/panel-base";
import { GraficoVentas } from "@/components/admin/grafico-ventas";
import type { Panel } from "@/lib/admin";
import { DIAS_TOP, type DatosDashboard, type Totales } from "@/lib/panel-datos";
import { formatBs, formatUsd } from "@/lib/precios";
import type { VistaVentas } from "@/lib/fechas";

const VISTAS: { vista: VistaVentas; texto: string }[] = [
  { vista: "dias", texto: "Días" },
  { vista: "semanas", texto: "Semanas" },
  { vista: "meses", texto: "Meses" },
];

function Kpi({ titulo, t, id }: { titulo: string; t: Totales; id: string }) {
  return (
    <div className={tarjeta} data-kpi={id}>
      <p className="text-sm text-muted">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{formatUsd(t.total_usd)}</p>
      <p className="text-sm text-muted">
        {formatBs(t.total_bs)} · {t.pedidos} {t.pedidos === 1 ? "pedido" : "pedidos"}
      </p>
    </div>
  );
}

const chip = (activo: boolean) =>
  `rounded-full px-3 py-1 text-sm font-medium ${activo ? "bg-foreground text-background" : "border border-line text-muted hover:bg-surface"}`;

export function VistaDashboard({ panel, datos, contexto }: { panel: Panel; datos: DatosDashboard; contexto: Contexto }) {
  const { kpis, serie, grano, masVendidos, vista, topDias, pedidosNuevos, hoy } = datos;
  const enlace = (v: VistaVentas, t: number) => `${contexto.base}?vista=${v}&top=${t}`;
  const maxUnidades = Math.max(...masVendidos.map((p) => p.unidades), 1);

  return (
    <main>
      <AvisoPausa panel={panel} contexto={contexto} />
      <Titulo descripcion="Cuentan como venta los pedidos confirmados, pagados, listos y entregados. Los días son de hora de Venezuela.">Dashboard</Titulo>

      {pedidosNuevos > 0 && (
        <Link
          href={`${contexto.base}/pedidos?estado=nuevo`}
          className="mb-5 block rounded-lg bg-amber-100 p-3 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          Tienes {pedidosNuevos} {pedidosNuevos === 1 ? "pedido nuevo" : "pedidos nuevos"} por revisar →
        </Link>
      )}

      <section aria-label="Resumen de ventas" className="grid gap-3 sm:grid-cols-3">
        <Kpi id="hoy" titulo="Hoy" t={kpis.hoy} />
        <Kpi id="siete" titulo="Últimos 7 días" t={kpis.sieteDias} />
        <Kpi id="treinta" titulo="Últimos 30 días" t={kpis.treintaDias} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
        <section aria-labelledby="ventas" className={tarjeta}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="ventas" className="text-lg font-semibold">Ventas</h2>
            <nav aria-label="Periodo del gráfico" className="flex gap-1.5">
              {VISTAS.map((v) => (
                <Link key={v.vista} href={enlace(v.vista, topDias)} aria-current={v.vista === vista ? "true" : undefined} className={chip(v.vista === vista)}>
                  {v.texto}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-4">
            <GraficoVentas serie={serie} grano={grano} anioActual={hoy.slice(0, 4)} />
          </div>
        </section>

        <section aria-labelledby="top" className={tarjeta}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="top" className="text-lg font-semibold">Más vendidos</h2>
            <nav aria-label="Periodo de más vendidos" className="flex gap-1.5">
              {DIAS_TOP.map((d) => (
                <Link key={d} href={enlace(vista, d)} aria-current={d === topDias ? "true" : undefined} className={chip(d === topDias)}>
                  {d} días
                </Link>
              ))}
            </nav>
          </div>
          {masVendidos.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Todavía no hay ventas en este periodo.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {masVendidos.map((p, i) => (
                <li key={`${p.producto_id ?? p.nombre}-${i}`} data-vendido={p.nombre}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{i + 1}. {p.nombre}</span>
                    <span className="shrink-0 text-muted">{p.unidades} u. · {formatUsd(p.total_usd)}</span>
                  </div>
                  <progress value={p.unidades} max={maxUnidades} aria-label={`${p.unidades} unidades de ${p.nombre}`} className="mt-1 h-1.5 w-full appearance-none overflow-hidden rounded-full bg-surface [&::-moz-progress-bar]:bg-foreground [&::-webkit-progress-bar]:bg-surface [&::-webkit-progress-value]:bg-foreground" />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
