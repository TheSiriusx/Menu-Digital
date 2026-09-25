import Link from "next/link";
import { cambiarEstadoPedido } from "@/app/admin/actions";
import { CampoNegocio } from "@/components/admin/campo-negocio";
import { EstadoPedidoBadge } from "@/components/admin/estado-pedido";
import { estiloCampo } from "@/components/admin/estilos";
import { AvisoPausa, Editable, tarjeta, Titulo, type Contexto } from "@/components/admin/panel-base";
import { Boton, FormAccion } from "@/components/admin/ui";
import type { Panel } from "@/lib/admin";
import { fechaHora } from "@/lib/fechas";
import { POR_PAGINA, type FiltrosPedidos } from "@/lib/panel-datos";
import { ESTADOS, ETIQUETA_ESTADO, TRANSICIONES } from "@/lib/pedidos-estados";
import { formatBs, formatUsd, usdToBs } from "@/lib/precios";
import type { Pedido } from "@/types/panel";

function enlacePagina(base: string, f: FiltrosPedidos, pagina: number) {
  const q = new URLSearchParams();
  if (f.estado) q.set("estado", f.estado);
  if (f.desde) q.set("desde", f.desde);
  if (f.hasta) q.set("hasta", f.hasta);
  if (pagina > 1) q.set("pagina", String(pagina));
  const texto = q.toString();
  return `${base}/pedidos${texto ? `?${texto}` : ""}`;
}

function Detalle({ pedido, negocioId }: { pedido: Pedido; negocioId: string }) {
  const acciones = TRANSICIONES[pedido.estado];
  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3 text-sm">
      <ul className="space-y-1">
        {pedido.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span>{i.cantidad} × {i.nombre_producto}</span>
            <span className="shrink-0 text-muted">{formatUsd(i.cantidad * i.precio_unitario_usd)}</span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between gap-3 font-medium">
        <span>Total</span>
        <span>
          {formatUsd(pedido.total_usd)}
          {pedido.tasa_bs > 0 && <span className="font-normal text-muted"> · {formatBs(usdToBs(pedido.total_usd, pedido.tasa_bs))}</span>}
        </span>
      </p>
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
        <dt className="text-muted">Teléfono</dt>
        <dd>
          <a href={`https://wa.me/${pedido.cliente_telefono}`} target="_blank" rel="noopener noreferrer" className="underline">
            {pedido.cliente_telefono}
          </a>
        </dd>
        <dt className="text-muted">Entrega</dt>
        <dd>{pedido.entrega === "domicilio" ? `A domicilio${pedido.direccion ? `: ${pedido.direccion}` : ""}` : "Retira en el local"}</dd>
        {pedido.metodo_pago && (
          <>
            <dt className="text-muted">Pago</dt>
            <dd>{pedido.metodo_pago}</dd>
          </>
        )}
        {pedido.notas && (
          <>
            <dt className="text-muted">Notas</dt>
            <dd className="break-words">{pedido.notas}</dd>
          </>
        )}
        <dt className="text-muted">Tasa</dt>
        <dd>{pedido.tasa_bs > 0 ? `Bs ${String(pedido.tasa_bs).replace(".", ",")} por $1 al momento del pedido` : "—"}</dd>
      </dl>

      {acciones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {acciones.map((a) =>
            a.peligro ? (
              <details key={a.estado}>
                <summary className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-400">{a.texto}</summary>
                <FormAccion accion={cambiarEstadoPedido} className="mt-2">
                  <CampoNegocio id={negocioId} />
                  <input type="hidden" name="id" value={pedido.id} />
                  <input type="hidden" name="estado" value={a.estado} />
                  <p className="mb-2">Se devuelve el stock de los productos. ¿Seguro?</p>
                  <Boton variante="peligro" tamano="compacto">Sí, cancelar</Boton>
                </FormAccion>
              </details>
            ) : (
              <FormAccion key={a.estado} accion={cambiarEstadoPedido}>
                <CampoNegocio id={negocioId} />
                <input type="hidden" name="id" value={pedido.id} />
                <input type="hidden" name="estado" value={a.estado} />
                <Boton variante="suave" tamano="compacto">{a.texto}</Boton>
              </FormAccion>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function VistaPedidos({
  panel,
  pedidos,
  total,
  filtros,
  contexto,
}: {
  panel: Panel;
  pedidos: Pedido[];
  total: number;
  filtros: FiltrosPedidos;
  contexto: Contexto;
}) {
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const hayFiltros = Boolean(filtros.estado || filtros.desde || filtros.hasta);

  return (
    <main>
      <AvisoPausa panel={panel} contexto={contexto} />
      <Titulo descripcion="Los pedidos que llegan por WhatsApp. Abre uno para ver el detalle y cambiar su estado.">Pedidos</Titulo>

      <form method="get" action={`${contexto.base}/pedidos`} className={`${tarjeta} mb-5 flex flex-wrap items-end gap-3`} aria-label="Filtrar pedidos">
        <label className="flex flex-col gap-1 text-sm">
          Estado
          <select name="estado" defaultValue={filtros.estado ?? ""} className={`${estiloCampo} w-40!`}>
            <option value="">Todos</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Desde
          <input type="date" name="desde" defaultValue={filtros.desde ?? ""} className={`${estiloCampo} w-40!`} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hasta
          <input type="date" name="hasta" defaultValue={filtros.hasta ?? ""} className={`${estiloCampo} w-40!`} />
        </label>
        <button type="submit" className="rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background">Filtrar</button>
        {hayFiltros && <Link href={`${contexto.base}/pedidos`} className="py-2.5 text-sm text-muted underline">Quitar filtros</Link>}
      </form>

      <p className="mb-3 text-sm text-muted" role="status">
        {total === 0 ? "No hay pedidos" : `${total} ${total === 1 ? "pedido" : "pedidos"}`}
        {hayFiltros ? " con estos filtros" : ""}.
      </p>

      {pedidos.length === 0 && total > 0 && (
        <p className="mb-3 text-sm">
          Esa página no existe. <Link href={enlacePagina(contexto.base, filtros, 1)} className="underline">Ir a la primera</Link>
        </p>
      )}

      <Editable panel={panel} contexto={contexto}>
        <ul className="space-y-2" aria-label="Lista de pedidos">
          {pedidos.map((p) => (
            <li key={p.id} data-pedido={p.id} data-estado={p.estado} className={tarjeta}>
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.cliente_nombre || p.cliente_telefono}</span>
                    <span className="block text-xs text-muted">{fechaHora(p.created_at)}</span>
                  </span>
                  <span className="font-medium">{formatUsd(p.total_usd)}</span>
                  <EstadoPedidoBadge estado={p.estado} />
                </summary>
                <Detalle pedido={p} negocioId={panel.negocio.id} />
              </details>
            </li>
          ))}
        </ul>
      </Editable>

      {paginas > 1 && (
        <nav aria-label="Páginas" className="mt-5 flex items-center justify-between text-sm">
          {filtros.pagina > 1 ? (
            <Link href={enlacePagina(contexto.base, filtros, filtros.pagina - 1)} rel="prev" className="rounded-full border border-line px-4 py-2">← Anterior</Link>
          ) : <span />}
          <span className="text-muted">Página {filtros.pagina} de {paginas}</span>
          {filtros.pagina < paginas ? (
            <Link href={enlacePagina(contexto.base, filtros, filtros.pagina + 1)} rel="next" className="rounded-full border border-line px-4 py-2">Siguiente →</Link>
          ) : <span />}
        </nav>
      )}
    </main>
  );
}
