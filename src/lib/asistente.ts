// Configuración del asistente de WhatsApp de cada panadería (tabla agente_config, migración 0011).
// La usan el panel (para editarla) y el agente (agente/) para comportarse según cada local.

export const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"] as const;
export type Dia = (typeof DIAS)[number];

export const NOMBRE_DIA: Record<Dia, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

export type Tramo = { desde: string; hasta: string };
export type Horario = Partial<Record<Dia, Tramo[]>>;

export type PagoMomento = "al_registrar" | "al_confirmar";
export type DeliveryModo = "retiro" | "cotizado" | "tarifa";

export type ConfigAsistente = {
  agente_activo: boolean;
  pausado_hasta: string | null;
  horario: Horario;
  acepta_fuera_horario: boolean;
  datos_pago: string;
  pago_momento: PagoMomento;
  delivery_modo: DeliveryModo;
  delivery_tarifa_usd: number | null;
  delivery_texto: string;
  resena_url: string | null;
  resena_espera_min: number;
  telefono_dueno: string | null;
  recordatorio_1_min: number | null;
  recordatorio_2_min: number | null;
  stock_aviso_umbral: number;
  encargo_aviso_horas: number;
  pedido_grande_usd: number;
  pedido_grande_unidades: number;
};

export const COLUMNAS_ASISTENTE =
  "agente_activo, pausado_hasta, horario, acepta_fuera_horario, datos_pago, pago_momento, delivery_modo, " +
  "delivery_tarifa_usd, delivery_texto, resena_url, resena_espera_min, telefono_dueno, recordatorio_1_min, " +
  "recordatorio_2_min, stock_aviso_umbral, encargo_aviso_horas, pedido_grande_usd, pedido_grande_unidades";

// Los numéricos llegan como texto desde la base de datos.
export function normalizarAsistente(fila: Record<string, unknown>): ConfigAsistente {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    ...(fila as unknown as ConfigAsistente),
    delivery_tarifa_usd: num(fila.delivery_tarifa_usd),
    resena_espera_min: Number(fila.resena_espera_min),
    recordatorio_1_min: num(fila.recordatorio_1_min),
    recordatorio_2_min: num(fila.recordatorio_2_min),
    stock_aviso_umbral: Number(fila.stock_aviso_umbral),
    encargo_aviso_horas: Number(fila.encargo_aviso_horas),
    pedido_grande_usd: Number(fila.pedido_grande_usd),
    pedido_grande_unidades: Number(fila.pedido_grande_unidades),
    horario: (fila.horario ?? {}) as Horario,
  };
}

// ¿Está el asistente atendiendo en este momento? (encendido y sin pausa vigente)
export function asistenteEncendido(c: Pick<ConfigAsistente, "agente_activo" | "pausado_hasta">, ahora = new Date()): boolean {
  return c.agente_activo && !(c.pausado_hasta && new Date(c.pausado_hasta) > ahora);
}

export const ESPERAS_RESENA = [60, 120, 180, 240, 360] as const;
