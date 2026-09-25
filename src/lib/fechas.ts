// Fechas en hora de Venezuela (America/Caracas, UTC-4 todo el año, sin horario de verano).
// Los días del dashboard y los filtros se cuentan en esa hora, no en UTC: una venta a las 11:30 p. m.
// del día 24 en Caracas es del día 24 aunque en UTC ya sea el 25. Las fechas viajan como "AAAA-MM-DD".

export const ZONA = "America/Caracas";
export type Grano = "day" | "week" | "month";
export type VistaVentas = "dias" | "semanas" | "meses";

const aUTC = (f: string) => new Date(`${f}T00:00:00Z`);
const aTexto = (d: Date) => d.toISOString().slice(0, 10);

// Hoy en Venezuela.
export function hoyCaracas(ahora: Date = new Date()): string {
  return ahora.toLocaleDateString("en-CA", { timeZone: ZONA });
}

export function esFecha(texto: unknown): texto is string {
  if (typeof texto !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const d = aUTC(texto);
  return !Number.isNaN(d.getTime()) && aTexto(d) === texto; // descarta el 2026-02-30
}

export function sumarDias(fecha: string, n: number): string {
  const d = aUTC(fecha);
  d.setUTCDate(d.getUTCDate() + n);
  return aTexto(d);
}

// Lunes de la semana de esa fecha (igual que date_trunc('week') de Postgres).
export function inicioSemana(fecha: string): string {
  const d = aUTC(fecha);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return aTexto(d);
}

export function inicioMes(fecha: string): string {
  return `${fecha.slice(0, 8)}01`;
}

// Primer día del mes que está n meses antes o después.
export function sumarMeses(fecha: string, n: number): string {
  const [anio, mes] = fecha.split("-").map(Number);
  const total = anio * 12 + (mes - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

export function inicioDe(fecha: string, grano: Grano): string {
  return grano === "week" ? inicioSemana(fecha) : grano === "month" ? inicioMes(fecha) : fecha;
}

// Todos los inicios de periodo entre dos fechas (para dibujar también los periodos sin ventas).
export function periodos(desde: string, hasta: string, grano: Grano): string[] {
  const salida: string[] = [];
  let actual = inicioDe(desde, grano);
  const ultimo = inicioDe(hasta, grano);
  for (let i = 0; i < 400 && actual <= ultimo; i++) {
    salida.push(actual);
    actual = grano === "day" ? sumarDias(actual, 1) : grano === "week" ? sumarDias(actual, 7) : sumarMeses(actual, 1);
  }
  return salida;
}

// Rango que cubre cada vista del gráfico: 14 días, 12 semanas o 12 meses, siempre hasta hoy.
export function rangoVista(vista: VistaVentas, hoy: string): { desde: string; hasta: string; grano: Grano } {
  if (vista === "semanas") return { desde: sumarDias(inicioSemana(hoy), -77), hasta: hoy, grano: "week" };
  if (vista === "meses") return { desde: sumarMeses(inicioMes(hoy), -11), hasta: hoy, grano: "month" };
  return { desde: sumarDias(hoy, -13), hasta: hoy, grano: "day" };
}

// Límites de un día de Venezuela como instantes exactos (para filtrar created_at).
export const inicioDiaISO = (f: string) => `${f}T00:00:00-04:00`;
export const finDiaISO = (f: string) => `${f}T23:59:59.999-04:00`;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// "24 sep" (o "24 sep 2026" si no es del año indicado).
export function fechaCorta(fecha: string, anioActual?: string): string {
  const [a, m, d] = fecha.split("-");
  const base = `${Number(d)} ${MESES[Number(m) - 1]}`;
  return anioActual && a !== anioActual ? `${base} ${a}` : base;
}

export function etiquetaPeriodo(inicio: string, grano: Grano, anioActual?: string): string {
  if (grano === "month") return `${MESES[Number(inicio.slice(5, 7)) - 1]}${anioActual && inicio.slice(0, 4) !== anioActual ? " " + inicio.slice(2, 4) : ""}`;
  if (grano === "week") return `sem ${fechaCorta(inicio, anioActual)}`;
  return fechaCorta(inicio, anioActual);
}

// "24 sep 2026, 11:30 p. m." en hora de Venezuela, a partir de un instante ISO.
export function fechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-VE", { timeZone: ZONA, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
