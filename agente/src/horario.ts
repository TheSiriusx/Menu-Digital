// Horario del local en hora de Venezuela (sin horario de verano: UTC-4 todo el año).
import { DIAS, NOMBRE_DIA, type Dia, type Horario, type Tramo } from "../../src/lib/asistente.ts";

export const ZONA = "America/Caracas";

export type Momento = { fecha: string; dia: Dia; hhmm: string };

// Día de la semana en la posición de Date.getDay() (0 = domingo).
const POR_INDICE: Dia[] = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

export function momento(ahora: Date = new Date()): Momento {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(ahora).map((p) => [p.type, p.value]),
  );
  const fecha = `${partes.year}-${partes.month}-${partes.day}`;
  const dia = POR_INDICE[new Date(`${fecha}T12:00:00Z`).getUTCDay()];
  return { fecha, dia, hhmm: `${partes.hour}:${partes.minute}` };
}

const tramos = (h: Horario, d: Dia): Tramo[] => (Array.isArray(h[d]) ? (h[d] as Tramo[]) : []);

export function estaAbierto(h: Horario, ahora: Date = new Date()): boolean {
  const m = momento(ahora);
  return tramos(h, m.dia).some((t) => t.desde <= m.hhmm && m.hhmm < t.hasta);
}

// "7:00 pm"
export function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const sufijo = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${sufijo}`;
}

// Próxima apertura: { cuando: "hoy" | "mañana" | "el lunes", hora: "6:00 am" }, o null si nunca abre.
export function proximaApertura(h: Horario, ahora: Date = new Date()): { cuando: string; hora: string } | null {
  const m = momento(ahora);
  const i0 = DIAS.indexOf(m.dia);
  for (let k = 0; k < 8; k++) {
    const d = DIAS[(i0 + k) % 7];
    const t = tramos(h, d)
      .filter((x) => k > 0 || x.desde > m.hhmm)
      .sort((a, b) => a.desde.localeCompare(b.desde))[0];
    if (t) return { cuando: k === 0 ? "hoy" : k === 1 ? "mañana" : `el ${NOMBRE_DIA[d].toLowerCase()}`, hora: hora12(t.desde) };
  }
  return null;
}

// "Lunes a sábado: 6:00 am a 7:00 pm · Domingo: 6:00 am a 1:00 pm" (agrupa días seguidos con el mismo horario).
export function textoHorario(h: Horario): string {
  const firma = (d: Dia) => tramos(h, d).map((t) => `${hora12(t.desde)} a ${hora12(t.hasta)}`).join(" y ") || "cerrado";
  const grupos: { desde: Dia; hasta: Dia; texto: string }[] = [];
  for (const d of DIAS) {
    const texto = firma(d);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.texto === texto) ultimo.hasta = d;
    else grupos.push({ desde: d, hasta: d, texto });
  }
  return grupos
    .map((g) => `${NOMBRE_DIA[g.desde]}${g.desde === g.hasta ? "" : ` a ${NOMBRE_DIA[g.hasta].toLowerCase()}`}: ${g.texto}`)
    .join(" · ");
}

// Fecha legible en hora de Venezuela: "sábado 26/09, 3:30 pm".
export function fechaLegible(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const m = momento(d);
  const [, mes, dia] = m.fecha.split("-");
  return `${NOMBRE_DIA[m.dia].toLowerCase()} ${dia}/${mes}, ${hora12(m.hhmm)}`;
}

// «AAAA-MM-DD HH:MM» en hora de Venezuela -> instante. null si no es una fecha válida.
export function leerFechaHora(texto: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(String(texto ?? "").trim());
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00-04:00`);
  if (Number.isNaN(d.getTime()) || momento(d).fecha !== `${m[1]}-${m[2]}-${m[3]}`) return null;
  return d;
}
