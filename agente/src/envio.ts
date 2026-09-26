// Enviar mensajes como lo haría una persona: en partes cortas, con «escribiendo…» antes de cada una.
import type { Deps } from "./flujo.ts";
import type { Contexto } from "./tipos.ts";

// Parte un texto en hasta 3 mensajes, por párrafos, sin cortar un párrafo a la mitad.
export function partir(texto: string, largo = 700): string[] {
  const parrafos = texto.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const partes: string[] = [];
  for (const p of parrafos) {
    const ultimo = partes[partes.length - 1];
    if (ultimo !== undefined && (ultimo.length + p.length + 2 <= 280 || partes.length >= 3)) partes[partes.length - 1] = `${ultimo}\n\n${p}`;
    else partes.push(p);
  }
  return partes.map((p) => (p.length > largo * 3 ? p.slice(0, largo * 3) : p));
}

export async function enviar(deps: Deps, instancia: string, destino: string, texto: string, contactoId: number | null) {
  for (const parte of partir(texto)) {
    try {
      await deps.evolution.escribiendo(instancia, destino, Math.min(1000 + parte.length * 20, 4000));
    } catch {
      // «escribiendo…» es cosmético: si falla, se envía igual.
    }
    await deps.dormir(Math.min(800 + parte.length * 15, 3000));
    const id = await deps.evolution.enviarTexto(instancia, destino, parte);
    deps.almacen.marcarEnviado(id);
    if (contactoId !== null) deps.almacen.guardarMensaje(contactoId, "asistente", parte);
  }
}

// A dónde van los avisos al dueño: el número que puso en su panel o, si no, el chat consigo mismo del
// WhatsApp del local (ahí también da sus comandos).
export function destinoDueno(deps: Deps, ctx: Contexto): string | null {
  return ctx.config.telefono_dueno ?? deps.almacen.numeroPropio(ctx.instancia) ?? ctx.negocio.telefono ?? null;
}

export async function avisarDueno(deps: Deps, ctx: Contexto, texto: string, imagen?: { base64: string; mimetype: string }) {
  const destino = destinoDueno(deps, ctx);
  if (!destino) {
    deps.log("aviso al dueño sin destino", { instancia: ctx.instancia });
    return;
  }
  try {
    const id = imagen
      ? await deps.evolution.enviarImagen(ctx.instancia, destino, imagen.base64, imagen.mimetype, texto)
      : await deps.evolution.enviarTexto(ctx.instancia, destino, texto);
    deps.almacen.marcarEnviado(id);
  } catch (e) {
    deps.log("no se pudo avisar al dueño", { instancia: ctx.instancia, error: (e as Error).message });
  }
}
