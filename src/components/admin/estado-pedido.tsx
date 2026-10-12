import { ETIQUETA_ESTADO, type EstadoPedido } from "@/lib/pedidos-estados";

const colores: Record<EstadoPedido, string> = {
  nuevo: "bg-brand text-accent",
  confirmado: "border-2 border-brand bg-surface-200 text-brand-text",
  pagado: "bg-deep text-accent",
  listo: "bg-accent text-deep",
  entregado: "border border-line bg-surface-200 text-ink-muted",
  cancelado: "border border-dashed border-ink-muted text-ink-muted line-through",
};

// El estado siempre va con texto: el color solo refuerza.
export function EstadoPedidoBadge({ estado }: { estado: EstadoPedido }) {
  return <span className={`inline-block rounded-brand-sm px-2.5 py-1 text-[11.5px] font-semibold ${colores[estado]}`}>{ETIQUETA_ESTADO[estado]}</span>;
}
