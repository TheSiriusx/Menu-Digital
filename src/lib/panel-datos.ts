import { crearClienteServidor } from "@/lib/supabase/server";
import {
  esFecha,
  finDiaISO,
  hoyCaracas,
  inicioDiaISO,
  periodos,
  rangoVista,
  sumarDias,
  type VistaVentas,
} from "@/lib/fechas";
import { esEstado, type EstadoPedido } from "@/lib/pedidos-estados";
import type { ClienteResumen, Pedido, PedidoItem, ProductoVendido, VentaPeriodo } from "@/types/panel";

// Cargadores de datos del panel. Van con la sesión de quien mira, así que el RLS decide: un dueño solo
// obtiene filas de su local aunque pase el id de otro. Quien llama ya comprobó la sesión y eligió el local.

const num = (v: unknown) => Number(v ?? 0);
export const POR_PAGINA = 25;

// ---------------------------------------------------------------- pedidos

export type FiltrosPedidos = { estado: EstadoPedido | null; desde: string | null; hasta: string | null; pagina: number };

type Params = Record<string, string | string[] | undefined>;
const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Lee y VALIDA los filtros de la URL: lo que no es válido se ignora (nada de la URL llega tal cual a la consulta).
export function leerFiltrosPedidos(params: Params): FiltrosPedidos {
  const estado = primero(params.estado);
  const desde = primero(params.desde);
  const hasta = primero(params.hasta);
  const pagina = Number(primero(params.pagina));
  return {
    estado: esEstado(estado) ? estado : null,
    desde: esFecha(desde) ? desde : null,
    hasta: esFecha(hasta) ? hasta : null,
    pagina: Number.isInteger(pagina) && pagina >= 1 && pagina <= 10000 ? pagina : 1,
  };
}

export async function cargarPedidos(negocioId: string, f: FiltrosPedidos): Promise<{ pedidos: Pedido[]; total: number }> {
  const supabase = await crearClienteServidor();
  const desdeFila = (f.pagina - 1) * POR_PAGINA;

  let consulta = supabase
    .from("pedidos")
    .select(
      "id, cliente_nombre, cliente_telefono, total_usd, tasa_bs, metodo_pago, estado, entrega, direccion, notas, created_at",
      { count: "exact" },
    )
    .eq("negocio_id", negocioId);
  if (f.estado) consulta = consulta.eq("estado", f.estado);
  if (f.desde) consulta = consulta.gte("created_at", inicioDiaISO(f.desde));
  if (f.hasta) consulta = consulta.lte("created_at", finDiaISO(f.hasta));
  const { data, count, error } = await consulta.order("created_at", { ascending: false }).range(desdeFila, desdeFila + POR_PAGINA - 1);
  // Una página más allá del final no es un fallo: PostgREST responde 416 y aquí se muestra vacía (con el total real).
  if (error?.code === "PGRST103") {
    let cuenta = supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("negocio_id", negocioId);
    if (f.estado) cuenta = cuenta.eq("estado", f.estado);
    if (f.desde) cuenta = cuenta.gte("created_at", inicioDiaISO(f.desde));
    if (f.hasta) cuenta = cuenta.lte("created_at", finDiaISO(f.hasta));
    const { count: total } = await cuenta;
    return { pedidos: [], total: total ?? 0 };
  }
  if (error) throw new Error(`No se pudieron leer los pedidos: ${error.message}`);
  const filas = data ?? [];

  const items = new Map<string, PedidoItem[]>();
  if (filas.length > 0) {
    const { data: lineas, error: errorItems } = await supabase
      .from("pedido_items")
      .select("id, pedido_id, nombre_producto, cantidad, precio_unitario_usd")
      .eq("negocio_id", negocioId)
      .in("pedido_id", filas.map((p) => p.id as string))
      .order("nombre_producto");
    if (errorItems) throw new Error(`No se pudieron leer los items: ${errorItems.message}`);
    for (const l of lineas ?? []) {
      const lista = items.get(l.pedido_id as string) ?? [];
      lista.push({ ...(l as PedidoItem), cantidad: num(l.cantidad), precio_unitario_usd: num(l.precio_unitario_usd) });
      items.set(l.pedido_id as string, lista);
    }
  }

  return {
    total: count ?? 0,
    pedidos: filas.map((p) => ({
      ...(p as unknown as Pedido),
      total_usd: num(p.total_usd),
      tasa_bs: num(p.tasa_bs),
      items: items.get(p.id as string) ?? [],
    })),
  };
}

// ---------------------------------------------------------------- clientes

export async function cargarClientes(negocioId: string): Promise<ClienteResumen[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("clientes_resumen", { p_negocio: negocioId, p_limite: 500 });
  if (error) throw new Error(`No se pudieron leer los clientes: ${error.message}`);
  return ((data ?? []) as ClienteResumen[]).map((c) => ({ ...c, pedidos: num(c.pedidos), total_usd: num(c.total_usd) }));
}

// ---------------------------------------------------------------- dashboard

export type Totales = { pedidos: number; total_usd: number; total_bs: number };
export type DatosDashboard = {
  hoy: string;
  vista: VistaVentas;
  topDias: number;
  kpis: { hoy: Totales; sieteDias: Totales; treintaDias: Totales };
  serie: VentaPeriodo[]; // con todos los periodos, también los que no tuvieron ventas
  grano: "day" | "week" | "month";
  masVendidos: ProductoVendido[];
  pedidosNuevos: number;
};

const sumar = (filas: VentaPeriodo[]): Totales =>
  filas.reduce((t, f) => ({ pedidos: t.pedidos + f.pedidos, total_usd: t.total_usd + f.total_usd, total_bs: t.total_bs + f.total_bs }), {
    pedidos: 0,
    total_usd: 0,
    total_bs: 0,
  });

export async function cargarDashboard(negocioId: string, vista: VistaVentas, topDias: number): Promise<DatosDashboard> {
  const supabase = await crearClienteServidor();
  const hoy = hoyCaracas();
  const rango = rangoVista(vista, hoy);

  const [treinta, grafico, top, nuevos] = await Promise.all([
    supabase.rpc("ventas_por_periodo", { p_negocio: negocioId, p_desde: sumarDias(hoy, -29), p_hasta: hoy, p_grano: "day" }),
    supabase.rpc("ventas_por_periodo", { p_negocio: negocioId, p_desde: rango.desde, p_hasta: rango.hasta, p_grano: rango.grano }),
    supabase.rpc("productos_mas_vendidos", { p_negocio: negocioId, p_desde: sumarDias(hoy, -(topDias - 1)), p_hasta: hoy, p_limite: 8 }),
    supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("negocio_id", negocioId).eq("estado", "nuevo"),
  ]);
  for (const r of [treinta, grafico, top]) if (r.error) throw new Error(`No se pudo leer el dashboard: ${r.error.message}`);

  const conversion = (filas: unknown): VentaPeriodo[] =>
    ((filas ?? []) as VentaPeriodo[]).map((f) => ({ periodo: f.periodo, pedidos: num(f.pedidos), total_usd: num(f.total_usd), total_bs: num(f.total_bs) }));
  const dias30 = conversion(treinta.data);
  const porPeriodo = new Map(conversion(grafico.data).map((f) => [f.periodo, f]));

  return {
    hoy,
    vista,
    topDias,
    grano: rango.grano,
    kpis: {
      hoy: sumar(dias30.filter((f) => f.periodo === hoy)),
      sieteDias: sumar(dias30.filter((f) => f.periodo >= sumarDias(hoy, -6))),
      treintaDias: sumar(dias30),
    },
    serie: periodos(rango.desde, rango.hasta, rango.grano).map(
      (p) => porPeriodo.get(p) ?? { periodo: p, pedidos: 0, total_usd: 0, total_bs: 0 },
    ),
    masVendidos: ((top.data ?? []) as ProductoVendido[]).map((p) => ({ ...p, unidades: num(p.unidades), total_usd: num(p.total_usd) })),
    pedidosNuevos: nuevos.count ?? 0,
  };
}

// Filtros del dashboard desde la URL: solo valores de una lista corta (nada más llega a la consulta).
export const DIAS_TOP = [7, 30, 90] as const;
export function leerFiltrosDashboard(params: Params): { vista: VistaVentas; topDias: number } {
  const vista = primero(params.vista);
  const top = Number(primero(params.top));
  return {
    vista: vista === "semanas" || vista === "meses" ? vista : "dias",
    topDias: (DIAS_TOP as readonly number[]).includes(top) ? top : 30,
  };
}
