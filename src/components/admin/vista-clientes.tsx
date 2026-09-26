import Link from "next/link";
import { AvisoPausa, tarjeta, Titulo, type Contexto } from "@/components/admin/panel-base";
import type { Panel } from "@/lib/admin";
import { fechaCorta } from "@/lib/fechas";
import { formatUsd } from "@/lib/precios";
import type { ClienteResumen } from "@/types/panel";

const chip = (activo: boolean) =>
  `rounded-full px-3 py-1 text-sm font-medium ${activo ? "bg-foreground text-background" : "border border-line text-muted hover:bg-surface"}`;

// Fecha del día de Venezuela a partir del instante ISO.
const dia = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date(iso));

export function VistaClientes({
  panel,
  clientes,
  soloRecurrentes,
  anioActual,
  contexto,
}: {
  panel: Panel;
  clientes: ClienteResumen[];
  soloRecurrentes: boolean;
  anioActual: string;
  contexto: Contexto;
}) {
  const lista = soloRecurrentes ? clientes.filter((c) => c.pedidos >= 2) : clientes;
  const recurrentes = clientes.filter((c) => c.pedidos >= 2).length;

  return (
    <main>
      <AvisoPausa panel={panel} contexto={contexto} />
      <Titulo descripcion="Quienes te han hecho pedidos por WhatsApp. Se cuentan los pedidos no cancelados; el total gastado solo suma los confirmados, pagados, listos y entregados.">Clientes</Titulo>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <nav aria-label="Filtro de clientes" className="flex gap-1.5">
          <Link href={`${contexto.base}/clientes`} aria-current={!soloRecurrentes ? "true" : undefined} className={chip(!soloRecurrentes)}>
            Todos ({clientes.length})
          </Link>
          <Link href={`${contexto.base}/clientes?recurrentes=1`} aria-current={soloRecurrentes ? "true" : undefined} className={chip(soloRecurrentes)}>
            Recurrentes ({recurrentes})
          </Link>
        </nav>
        <span className="text-sm text-muted">Recurrente: 2 pedidos o más.</span>
      </div>

      {lista.length === 0 ? (
        <p className="text-muted">{soloRecurrentes ? "Todavía no hay clientes recurrentes." : "Todavía no hay clientes."}</p>
      ) : (
        <ul className={`${tarjeta} divide-y divide-line py-1`} aria-label="Lista de clientes">
          {lista.map((c) => (
            <li key={c.cliente_id} data-cliente={c.telefono} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3">
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate font-medium">{c.nombre || "Sin nombre"}</p>
                <a href={`https://wa.me/${c.telefono}`} target="_blank" rel="noopener noreferrer" className="text-sm text-muted underline">
                  {c.telefono}
                </a>
              </div>
              <p className="text-sm">
                <span className="font-medium">{c.pedidos}</span> {c.pedidos === 1 ? "pedido" : "pedidos"}
                {c.pedidos >= 2 && <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs">Recurrente</span>}
              </p>
              <p className="w-24 text-sm font-medium sm:text-right">{formatUsd(c.total_usd)}</p>
              <p className="w-32 text-sm text-muted sm:text-right">Última: {fechaCorta(dia(c.ultima_compra), anioActual)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
