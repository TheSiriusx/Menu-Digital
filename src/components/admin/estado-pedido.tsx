import { ETIQUETA_ESTADO, type EstadoPedido } from "@/lib/pedidos-estados";

const colores: Record<EstadoPedido, string> = {
  nuevo: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  confirmado: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  pagado: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  listo: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  entregado: "bg-surface text-foreground",
  cancelado: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

// El estado siempre va con texto: el color solo refuerza.
export function EstadoPedidoBadge({ estado }: { estado: EstadoPedido }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colores[estado]}`}>{ETIQUETA_ESTADO[estado]}</span>;
}
