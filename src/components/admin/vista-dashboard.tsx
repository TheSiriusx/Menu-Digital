import Link from "next/link";
import { AvisoPausa, tarjeta, Titulo, type Contexto } from "@/components/admin/panel-base";
import { GraficoVentas } from "@/components/admin/grafico-ventas";
import type { Panel } from "@/lib/admin";
import { DIAS_TOP, type DatosDashboard, type Totales } from "@/lib/panel-datos";
import { EstadoPedidoBadge } from "@/components/admin/estado-pedido";
import { formatBs, formatUsd } from "@/lib/precios";
import type { VistaVentas } from "@/lib/fechas";

const VISTAS: { vista: VistaVentas; texto: string }[] = [
  { vista: "dias", texto: "Días" },
  { vista: "semanas", texto: "Semanas" },
  { vista: "meses", texto: "Meses" },
];

const etiquetaKpi = "text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted";

function Kpi({ titulo, t, id }: { titulo: string; t: Totales; id: string }) {
  return (
    <div className={tarjeta} data-kpi={id}>
      <p className={etiquetaKpi}>{titulo}</p>
      <p className="mt-2 font-titulo text-[26px] font-semibold leading-none tabular-nums">{formatUsd(t.total_usd)}</p>
      <p className="mt-2 text-xs text-muted">
        {formatBs(t.total_bs)} · {t.pedidos} {t.pedidos === 1 ? "pedido" : "pedidos"}
      </p>
    </div>
  );
}

const chip = (activo: boolean) =>
  `rounded-full px-3 py-1 text-xs font-semibold ${activo ? "bg-(--acento) text-(--sobre-acento)" : "border border-line text-muted hover:bg-surface"}`;

export function VistaDashboard({ panel, datos, contexto }: { panel: Panel; datos: DatosDashboard; contexto: Contexto }) {
  const { kpis, serie, grano, masVendidos, vista, topDias, pedidosNuevos, hoy, recientes } = datos;
  const enlace = (v: VistaVentas, t: number) => `${contexto.base}?vista=${v}&top=${t}`;
  const maxUnidades = Math.max(...masVendidos.map((p) => p.unidades), 1);

  return (
    <main>
      <AvisoPausa panel={panel} contexto={contexto} />
      <Titulo descripcion="Cuentan como venta los pedidos confirmados, pagados, listos y entregados. Los días son de hora de Venezuela.">
        {contexto.superadmin ? "Dashboard" : `Buen día, ${panel.negocio.nombre}`}
      </Titulo>

      <section aria-label="Resumen de ventas" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi id="hoy" titulo="Ventas hoy" t={kpis.hoy} />
        <Kpi id="siete" titulo="Últimos 7 días" t={kpis.sieteDias} />
        <Kpi id="treinta" titulo="Últimos 30 días" t={kpis.treintaDias} />
        <div className={tarjeta} data-kpi="nuevos">
          <p className={etiquetaKpi}>Por atender</p>
          <p className="mt-2 font-titulo text-[26px] font-semibold leading-none tabular-nums">{pedidosNuevos}</p>
          {pedidosNuevos > 0 ? (
            <Link href={`${contexto.base}/pedidos?estado=nuevo`} className="mt-2 block text-xs font-semibold text-(--acento-texto)">
              {pedidosNuevos} {pedidosNuevos === 1 ? "pedido nuevo" : "pedidos nuevos"} por revisar →
            </Link>
          ) : (
            <p className="mt-2 text-xs text-muted">Nada pendiente</p>
          )}
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:items-start">
        <section aria-labelledby="recientes" className={tarjeta}>
          <div className="flex items-center justify-between gap-2">
            <h2 id="recientes" className="text-[14.5px] font-semibold">Pedidos recientes</h2>
            <Link href={`${contexto.base}/pedidos`} className="text-xs font-semibold text-(--acento-texto)">Ver todos →</Link>
          </div>
          {recientes.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Todavía no hay pedidos.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-[11.5px] uppercase tracking-[0.04em] text-muted">
                    <th className="pb-2.5 font-semibold">Cliente</th>
                    <th className="hidden pb-2.5 font-semibold sm:table-cell">Productos</th>
                    <th className="pb-2.5 font-semibold">Total</th>
                    <th className="pb-2.5 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recientes.map((p) => (
                    <tr key={p.id} className="border-t border-line">
                      <td className="py-2.5 pr-3 font-medium">{p.cliente}</td>
                      <td className="hidden max-w-[240px] truncate py-2.5 pr-3 text-muted sm:table-cell">{p.resumen || "—"}</td>
                      <td className="py-2.5 pr-3 tabular-nums">{formatUsd(p.total_usd)}</td>
                      <td className="py-2.5"><EstadoPedidoBadge estado={p.estado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="top" className={tarjeta}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="top" className="text-[14.5px] font-semibold">Más vendidos</h2>
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
            <ol className="mt-4 space-y-3.5">
              {masVendidos.map((p, i) => (
                <li key={`${p.producto_id ?? p.nombre}-${i}`} data-vendido={p.nombre}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0 truncate">{i + 1}. {p.nombre}</span>
                    <span className="shrink-0 text-muted">{p.unidades} u. · {formatUsd(p.total_usd)}</span>
                  </div>
                  <progress value={p.unidades} max={maxUnidades} aria-label={`${p.unidades} unidades de ${p.nombre}`} className="block h-1.5 w-full appearance-none overflow-hidden rounded-full bg-line [&::-moz-progress-bar]:bg-(--acento) [&::-webkit-progress-bar]:bg-line [&::-webkit-progress-value]:bg-(--acento)" />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section aria-labelledby="ventas" className={`${tarjeta} mt-6`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="ventas" className="text-[14.5px] font-semibold">Ventas</h2>
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
    </main>
  );
}
