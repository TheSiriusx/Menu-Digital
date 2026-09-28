import { ETIQUETA_ESTADO, type EstadoPedido } from "@/lib/pedidos-estados";

const colores: Record<EstadoPedido, string> = {
  nuevo: "bg-(--acento-suave) text-(--acento-texto)",
  confirmado: "bg-aviso-suave text-aviso",
  pagado: "bg-exito-suave text-exito",
  listo: "bg-exito text-white",
  entregado: "bg-surface text-foreground",
  cancelado: "bg-peligro-suave text-peligro",
};

// El estado siempre va con texto: el color solo refuerza.
export function EstadoPedidoBadge({ estado }: { estado: EstadoPedido }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${colores[estado]}`}>{ETIQUETA_ESTADO[estado]}</span>;
}
