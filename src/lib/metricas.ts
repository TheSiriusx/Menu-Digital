import type { requerirSuperadmin } from "@/lib/admin";
import { finDiaISO, hoyCaracas, inicioDiaISO, sumarDias } from "@/lib/fechas";

// Métricas de Analíticas y del reporte CSV (migración 0014). Todo sale de la base: visitas al menú, pedidos por
// WhatsApp, ventas (pedidos confirmados en adelante) y tiempo de respuesta del agente.

type Cliente = Awaited<ReturnType<typeof requerirSuperadmin>>["supabase"];

export const PERIODOS = [7, 30, 90] as const;
export type Periodo = (typeof PERIODOS)[number];
export const leerPeriodo = (v: unknown): Periodo => (PERIODOS.includes(Number(v) as Periodo) ? (Number(v) as Periodo) : 30);

export type FilaLocal = {
  id: string; slug: string; nombre: string; tipo: string; plan: string; activo: boolean; productos: number;
  duenos: string[]; instancia: string | null;
  visitas: number; pedidos: number; ventas_usd: number; respuestas: number; respuesta_mediana_s: number | null;
};
export type Dia = { dia: string; visitas: number; pedidos: number; ventas_usd: number };

export function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Pedidos por cada 100 visitas (null si aún no hay visitas).
export const conversion = (pedidos: number, visitas: number) => (visitas > 0 ? (pedidos / visitas) * 100 : null);

export async function cargarMetricas(supabase: Cliente, dias: Periodo) {
  const hasta = hoyCaracas();
  const desde = sumarDias(hasta, -(dias - 1));
  const [lista, met, diarias, resp] = await Promise.all([
    supabase.rpc("listar_negocios"),
    supabase.rpc("metricas_locales", { p_desde: desde, p_hasta: hasta }),
    supabase.rpc("metricas_diarias", { p_desde: desde, p_hasta: hasta }),
    supabase.from("agente_respuestas").select("segundos").gte("creado_en", inicioDiaISO(desde)).lte("creado_en", finDiaISO(hasta)).limit(50000),
  ]);
  if (lista.error) throw new Error(`No se pudieron listar los locales: ${lista.error.message}`);

  const porLocal = new Map(((met.data ?? []) as Record<string, unknown>[]).map((m) => [m.negocio_id as string, m]));
  const locales: FilaLocal[] = ((lista.data ?? []) as FilaLocal[]).map((l) => {
    const m = porLocal.get(l.id);
    return {
      ...l,
      visitas: Number(m?.visitas ?? 0),
      pedidos: Number(m?.pedidos ?? 0),
      ventas_usd: Number(m?.ventas_usd ?? 0),
      respuestas: Number(m?.respuestas ?? 0),
      respuesta_mediana_s: m?.respuesta_mediana_s === null || m?.respuesta_mediana_s === undefined ? null : Number(m.respuesta_mediana_s),
    };
  });
  const serie: Dia[] = ((diarias.data ?? []) as Record<string, unknown>[]).map((d) => ({
    dia: String(d.dia), visitas: Number(d.visitas), pedidos: Number(d.pedidos), ventas_usd: Number(d.ventas_usd),
  }));
  const segundos = ((resp.data ?? []) as { segundos: number }[]).map((r) => Number(r.segundos));

  return {
    desde,
    hasta,
    locales,
    serie,
    // Si alguna consulta de métricas falla, se avisa en la página en vez de mostrar ceros como si fueran datos.
    incompleto: Boolean(met.error || diarias.error || resp.error),
    totales: {
      visitas: locales.reduce((s, l) => s + l.visitas, 0),
      pedidos: locales.reduce((s, l) => s + l.pedidos, 0),
      ventas_usd: locales.reduce((s, l) => s + l.ventas_usd, 0),
      respuestas: segundos.length,
      respuesta_mediana_s: mediana(segundos),
    },
  };
}
