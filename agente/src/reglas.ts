// Reglas duras: se deciden con código, nunca con la IA. Son las que tienen que ser predecibles
// (confirmar un pedido, detectar alergias, comandos del dueño).
import { normalizar } from "./texto.ts";

// Alergias e ingredientes: SIEMPRE una persona (decisión del negocio: el bot nunca opina sobre esto).
const ALERGIAS = /\b(alergi\w*|alergic\w*|gluten|celiac\w*|lactosa|lacteo\w*|intoleran\w*|ingredientes?|mani|nuez|nueces|almendras?|avellanas?|mariscos?|diabet\w*|sin azucar|anafila\w*)\b/;

// Quejas y temas delicados: también una persona.
const DELICADO = /\b(queja|quejas|reclamo|reclamar|estafa\w*|denuncia\w*|abogad\w*|devolucion|reembolso|intoxic\w*|mal estado|vencid[oa]s?|podrid[oa]s?|me cayo mal|pelo en)\b/;

export function motivoHumano(texto: string): "alergia" | "delicado" | null {
  const t = normalizar(texto);
  if (ALERGIAS.test(t)) return "alergia";
  if (DELICADO.test(t)) return "delicado";
  return null;
}

// «Sí» claro para confirmar un pedido. Tiene que ser SOLO una confirmación: «sí pero sin azúcar» no confirma.
const SI = new Set([
  "si", "sii", "siii", "sip", "sep", "dale", "ok", "okey", "okay", "listo", "confirmo", "confirmado", "confirmar",
  "correcto", "perfecto", "de acuerdo", "va", "vale", "esta bien", "asi esta bien", "todo bien", "exacto", "eso es",
  "si confirmo", "si dale", "si por favor", "si porfa", "si esta bien", "si correcto", "si perfecto", "dale si",
  "confirmo el pedido", "si confirmo el pedido", "si gracias", "dale gracias", "ok gracias", "listo gracias",
]);
const NO = new Set([
  "no", "nop", "nope", "no gracias", "mejor no", "cancela", "cancelalo", "cancelar", "olvidalo", "ya no", "no lo quiero",
  "no confirmo", "no quiero", "dejalo asi",
]);

// Un pulgar arriba también vale como «sí».
function soloPalabras(texto: string): string {
  const t = normalizar(texto.replace(/[👍👌✅]/gu, " "));
  return t === "" && /[👍👌✅]/u.test(texto) ? "si" : t;
}

export function esConfirmacion(texto: string): boolean {
  const t = soloPalabras(texto);
  return t.length > 0 && t.length <= 40 && SI.has(t);
}

export function esNegacion(texto: string): boolean {
  const t = soloPalabras(texto);
  return t.length > 0 && t.length <= 40 && NO.has(t);
}

// Comandos del dueño (en su chat consigo mismo o desde su teléfono de avisos).
export type Comando = { tipo: "ayuda" } | { tipo: "pedidos" } | { tipo: "encender" } | { tipo: "apagar"; horas: number | null };

export function comandoDueno(texto: string): Comando | null {
  const t = normalizar(texto);
  if (/^(ayuda|comandos|menu de comandos)$/.test(t)) return { tipo: "ayuda" };
  if (/^(pedidos|pedidos de hoy|pedidos hoy|ver pedidos)$/.test(t)) return { tipo: "pedidos" };
  if (/^(encender|prender|activar|encender asistente|encender bot)$/.test(t)) return { tipo: "encender" };
  const m = /^(apagar|pausar|silenciar)(?: (?:asistente|bot))?(?: (\d{1,3}) ?(?:h|hs|hora|horas))?$/.exec(t);
  if (m) {
    const horas = m[2] ? Number(m[2]) : null;
    return { tipo: "apagar", horas };
  }
  return null;
}
