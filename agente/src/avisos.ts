// Mensajes que no son respuesta a nada: cambios de estado del pedido (los hace el dueño en su panel),
// la reseña después de entregar y los recordatorios al dueño. Vienen de la cola agente_avisos (Supabase).
import { asistenteEncendido, normalizarAsistente } from "../../src/lib/asistente.ts";
import type { AvisoPendiente } from "./clientes.ts";
import { avisarDueno, enviar } from "./envio.ts";
import type { Deps } from "./flujo.ts";
import type { Contexto } from "./tipos.ts";
import { codigoPedido, precio, primerNombre } from "./texto.ts";

export function textoAviso(a: AvisoPendiente, ctx: Contexto, ahora: Date): { al: "cliente" | "dueno"; texto: string } | null {
  const p = a.pedido;
  const cod = codigoPedido(p.codigo);
  const hola = primerNombre(p.nombre) ? `¡Hola, ${primerNombre(p.nombre)}! ` : "¡Hola! ";
  const c = ctx.config;
  // Bs a la tasa de HOY (la del día en que se paga).
  const total = precio(p.total_usd, ctx.negocio.tasa_bs);

  if (a.clave.startsWith("recordatorio:")) {
    if (p.estado !== "nuevo") return null;
    const min = Math.max(1, Math.round((ahora.getTime() - new Date(p.creado).getTime()) / 60000));
    return { al: "dueno", texto: `⏰ El pedido ${cod} de ${p.nombre ?? p.telefono} sigue sin atender (hace ${min} min). Total: ${total}. Confírmalo en tu panel → Pedidos.` };
  }
  if (a.clave === "resena") {
    if (!c.resena_url) return null;
    return { al: "cliente", texto: `${hola}¿Qué tal estuvo tu pedido? 😊 Si te gustó, nos ayudaría muchísimo tu reseña: ${c.resena_url}` };
  }
  switch (a.clave) {
    case "estado:confirmado": {
      const pago = c.pago_momento === "al_confirmar" && c.datos_pago.trim()
        ? `\n\nTotal: ${total}.\nPara pagar:\n${c.datos_pago.trim()}\n\nCuando pagues, envíame la captura por aquí 📸`
        : "";
      return { al: "cliente", texto: `${hola}Confirmamos tu pedido ${cod} ✅ Ya lo estamos preparando.${pago}` };
    }
    case "estado:pagado":
      return { al: "cliente", texto: `${hola}Recibimos tu pago del pedido ${cod} ✅ ¡Gracias!` };
    case "estado:listo":
      return {
        al: "cliente",
        texto: p.entrega === "domicilio" ? `${hola}Tu pedido ${cod} va en camino 🛵` : `${hola}Tu pedido ${cod} ya está listo para retirar 🥖`,
      };
    case "estado:entregado":
      return { al: "cliente", texto: `${hola}Tu pedido ${cod} fue entregado. ¡Gracias por tu compra! 💛` };
    case "estado:cancelado":
      return { al: "cliente", texto: `${hola}Tu pedido ${cod} fue cancelado. Si es un error, escríbenos por aquí 🙏` };
    default:
      return null;
  }
}

export async function procesarAvisos(deps: Deps, limite = 20): Promise<number> {
  const lista = await deps.supabase.avisosTomar(limite);
  for (const a of lista) {
    try {
      await enviarAviso(deps, a);
      await deps.supabase.avisoResultado(a.id, true);
    } catch (e) {
      deps.log("no se pudo enviar un aviso", { id: a.id, error: (e as Error).message });
      await deps.supabase.avisoResultado(a.id, false, (e as Error).message).catch(() => {});
    }
  }
  return lista.length;
}

async function enviarAviso(deps: Deps, a: AvisoPendiente) {
  if (!a.instancia) throw new Error("el local no tiene WhatsApp vinculado");
  if (!a.config) throw new Error("el local no tiene configuración del asistente");
  const ctx: Contexto = {
    instancia: a.instancia,
    negocio: { id: "", slug: a.negocio.slug, nombre: a.negocio.nombre, activo: a.negocio.activo, tasa_bs: Number(a.negocio.tasa_bs) || 0, telefono: a.negocio.telefono, horario: null },
    config: normalizarAsistente(a.config),
  };
  const m = textoAviso(a, ctx, deps.ahora());
  if (!m) return;
  if (m.al === "dueno") {
    await avisarDueno(deps, ctx, m.texto);
    return;
  }
  // La reseña es opcional: con el asistente apagado no se pide. Los cambios de estado sí se avisan
  // (los hizo el dueño a propósito desde su panel).
  if (a.clave === "resena" && !asistenteEncendido(ctx.config, deps.ahora())) return;
  const contacto = deps.almacen.contactoPorTelefono(a.instancia, a.pedido.telefono);
  await enviar(deps, a.instancia, a.pedido.telefono, m.texto, contacto?.id ?? null);
}
