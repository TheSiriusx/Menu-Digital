// Estados de un pedido y qué puede hacer el dueño en cada uno. Es la MISMA máquina de estados que
// aplica la base de datos (_cambiar_estado_pedido, migración 0010): aquí solo decide qué botones se ven.

export const ESTADOS = ["nuevo", "confirmado", "pagado", "listo", "entregado", "cancelado"] as const;
export type EstadoPedido = (typeof ESTADOS)[number];

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  nuevo: "Nuevo",
  confirmado: "Confirmado",
  pagado: "Pagado",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

// Cuentan como venta en el dashboard y los reportes. Un pedido nuevo o cancelado no suma.
export const CUENTA_COMO_VENTA: readonly EstadoPedido[] = ["confirmado", "pagado", "listo", "entregado"];

export type Transicion = { estado: EstadoPedido; texto: string; peligro?: boolean };

export const TRANSICIONES: Record<EstadoPedido, Transicion[]> = {
  nuevo: [
    { estado: "confirmado", texto: "Confirmar" },
    { estado: "pagado", texto: "Marcar pagado" },
    { estado: "cancelado", texto: "Cancelar pedido", peligro: true },
  ],
  confirmado: [
    { estado: "pagado", texto: "Marcar pagado" },
    { estado: "listo", texto: "Marcar listo" },
    { estado: "entregado", texto: "Marcar entregado" },
    { estado: "cancelado", texto: "Cancelar pedido", peligro: true },
  ],
  pagado: [
    { estado: "listo", texto: "Marcar listo" },
    { estado: "entregado", texto: "Marcar entregado" },
    { estado: "cancelado", texto: "Cancelar pedido", peligro: true },
  ],
  // «Listo»: para retirar o en camino. Quien paga al retirar pasa de listo a pagado.
  listo: [
    { estado: "pagado", texto: "Marcar pagado" },
    { estado: "entregado", texto: "Marcar entregado" },
    { estado: "cancelado", texto: "Cancelar pedido", peligro: true },
  ],
  entregado: [],
  cancelado: [],
};

export function esEstado(valor: unknown): valor is EstadoPedido {
  return typeof valor === "string" && (ESTADOS as readonly string[]).includes(valor);
}
