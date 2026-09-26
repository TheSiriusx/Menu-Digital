// Registrar un pedido (venga del menú web o de la conversación) y los mensajes fijos que lo acompañan.
// Nada de esto pasa por la IA: precios, totales y confirmaciones salen de la base de datos.
import { parsearPedido } from "../../src/lib/pedido-agente.ts";
import { estaAbierto, proximaApertura } from "./horario.ts";
import type { Contacto, Contexto, ItemPedido, ResultadoCrearPedido } from "./tipos.ts";
import { codigoPedido, formatUsd, limpio, precio, primerNombre, soloDigitos } from "./texto.ts";

export type SolicitudPedido = {
  items: ItemPedido[];
  entrega: "retiro" | "domicilio";
  direccion: string | null;
  notas: string | null;
  nombre: string | null;
  origen: string;            // id del mensaje: el mismo mensaje nunca crea dos pedidos
  slug: string;              // el del mensaje del menú (se contrasta con el local de la instancia)
  alerta?: string | null;    // palabra delicada en las notas (se le avisa al dueño)
};

export type Resultado = { respuesta: string; avisoDueno: string | null; creado: boolean; pedidoId?: string };

type CrearPedido = { crearPedido(a: Parameters<import("./clientes.ts").Supabase["crearPedido"]>[0]): Promise<ResultadoCrearPedido> };

export function textoEntrega(ctx: Contexto, entrega: "retiro" | "domicilio", direccion: string | null): string {
  if (entrega === "retiro") return "Lo retiras en el local 🥖.";
  return `Te lo llevamos a: ${limpio(direccion, 200)} 🛵.`;
}

export function textoDelivery(ctx: Contexto, entrega: "retiro" | "domicilio"): string {
  if (entrega !== "domicilio") return "";
  const c = ctx.config;
  if (c.delivery_modo === "tarifa" && c.delivery_tarifa_usd !== null) {
    return `Delivery: ${precio(c.delivery_tarifa_usd, ctx.negocio.tasa_bs)} (aparte del total).`;
  }
  return "El costo del delivery te lo confirmamos según tu dirección.";
}

// Cerrado y sin aceptar pedidos fuera de horario: no se registra.
export function cerradoSinPedidos(ctx: Contexto, ahora: Date): string | null {
  if (ctx.config.acepta_fuera_horario || estaAbierto(ctx.config.horario, ahora)) return null;
  const p = proximaApertura(ctx.config.horario, ahora);
  return `Ahora estamos cerrados 🙏.${p ? ` Abrimos ${p.cuando} a las ${p.hora};` : ""} escríbenos entonces y con gusto te atendemos.`;
}

function notaCerrado(ctx: Contexto, ahora: Date): string {
  if (estaAbierto(ctx.config.horario, ahora)) return "";
  const p = proximaApertura(ctx.config.horario, ahora);
  return p ? `Ahora estamos cerrados: lo preparamos cuando abramos, ${p.cuando} a las ${p.hora}.` : "";
}

function textoPago(ctx: Contexto): string {
  const c = ctx.config;
  if (c.pago_momento === "al_confirmar") return "Te envío los datos para pagar cuando confirmemos tu pedido.";
  if (c.datos_pago.trim()) return `Para pagar:\n${c.datos_pago.trim()}\n\nCuando pagues, envíame la captura por aquí 📸`;
  return "¿Cómo prefieres pagar?";
}

const MOTIVOS: Record<string, string> = {
  stock_insuficiente: "",
  producto_no_disponible: "",
  producto_no_encontrado: "El menú cambió desde que armaste tu pedido 🙏.",
  codigo_ambiguo: "El menú cambió desde que armaste tu pedido 🙏.",
  negocio_pausado: "Ahora mismo no estamos tomando pedidos por aquí 🙏.",
  direccion_requerida: "Para entrega a domicilio necesito tu dirección 📍.",
  slug_no_coincide: "Ese pedido es de otro menú 😕.",
  items_invalidos: "Tu pedido no está completo 😕.",
  entrega_invalida: "Tu pedido no está completo 😕.",
  telefono_invalido: "No pude leer tu número de WhatsApp 😕.",
};

export async function registrarPedido(
  supabase: CrearPedido,
  ctx: Contexto,
  contacto: Contacto,
  s: SolicitudPedido,
  ahora: Date,
  menuUrl: string | null,
): Promise<Resultado> {
  const armarDeNuevo = menuUrl ? ` Puedes armarlo de nuevo en el menú: ${menuUrl}` : "";
  const cerrado = cerradoSinPedidos(ctx, ahora);
  if (cerrado) return { respuesta: cerrado, avisoDueno: null, creado: false };
  if (s.entrega === "domicilio" && ctx.config.delivery_modo === "retiro") {
    return { respuesta: `Por ahora solo tenemos retiro en el local 🙏.${armarDeNuevo}`, avisoDueno: null, creado: false };
  }

  const nombre = limpio(s.nombre ?? contacto.nombre, 60) || null;
  const telefono = soloDigitos(contacto.telefono);
  const resumenCrudo = s.items.map((i) => `${i.cantidad} x ${i.codigo}`).join(", ");
  if (!/^\d{10,15}$/.test(telefono)) {
    // Chat que llegó solo con el identificador interno de WhatsApp: no se inventa un teléfono.
    return {
      respuesta: "¡Recibí tu pedido! 🙌 Una persona del equipo lo confirma contigo en un momento.",
      avisoDueno: `🛒 Pedido SIN registrar: el chat de ${nombre ?? "un cliente"} no trae número de teléfono.\nPidió: ${resumenCrudo} (${s.entrega}).\nRegístralo a mano y escríbele.`,
      creado: false,
    };
  }

  let r: ResultadoCrearPedido;
  try {
    r = await supabase.crearPedido({
      instancia: ctx.instancia, slug: s.slug, telefono, nombre, items: s.items, entrega: s.entrega,
      direccion: s.direccion ? limpio(s.direccion, 300) : null, notas: s.notas ? limpio(s.notas, 500) : null, origen: s.origen,
    });
  } catch {
    return {
      respuesta: "Tuve un problema para registrar tu pedido 🙏. Una persona del equipo te atiende enseguida.",
      avisoDueno: `⚠️ No se pudo registrar un pedido (el sistema no respondió). Cliente: ${nombre ?? telefono} (${telefono}). Pidió: ${resumenCrudo}. Atiéndelo a mano.`,
      creado: false,
    };
  }

  if (!r.ok) {
    const det = (r.detalle ?? {}) as Record<string, unknown>;
    const prod = String(det.nombre ?? "ese producto");
    if (r.error === "stock_insuficiente") {
      return { respuesta: `Lo siento, de ${prod} solo me quedan ${det.disponible ?? 0} (pediste ${det.pedido ?? "?"}). ¿Lo ajustamos?${armarDeNuevo}`, avisoDueno: null, creado: false };
    }
    if (r.error === "producto_no_disponible") {
      return { respuesta: `Lo siento, ${prod} ya no está disponible hoy 🙏.${armarDeNuevo}`, avisoDueno: null, creado: false };
    }
    if (r.error in MOTIVOS) return { respuesta: MOTIVOS[r.error] + armarDeNuevo, avisoDueno: null, creado: false };
    return {
      respuesta: "Tuve un problema para registrar tu pedido 🙏. Una persona del equipo te atiende enseguida.",
      avisoDueno: `⚠️ Un pedido fue rechazado (${r.error}). Cliente: ${nombre ?? telefono} (${telefono}). Revisa la configuración de WhatsApp del local.`,
      creado: false,
    };
  }

  const cod = codigoPedido(r.pedido_id);
  const tasa = Number(r.tasa_bs ?? ctx.negocio.tasa_bs) || 0;
  if (r.duplicado) {
    return { respuesta: `Ya tenía registrado tu pedido ${cod} 👍. Total: ${precio(r.total_usd, tasa)}.`, avisoDueno: null, creado: true, pedidoId: r.pedido_id };
  }

  const items = r.items ?? [];
  const lineas = items.map((i) => `• ${i.cantidad} x ${i.nombre_producto} — ${formatUsd(i.cantidad * i.precio_unitario_usd)}`);
  const grande = r.total_usd >= ctx.config.pedido_grande_usd || items.some((i) => i.cantidad >= ctx.config.pedido_grande_unidades);
  const saludo = primerNombre(nombre);

  const respuesta = [
    `¡Listo${saludo ? `, ${saludo}` : ""}! Recibí tu pedido ${cod} 🎉`,
    [...lineas, `Total: ${precio(r.total_usd, tasa)}`, textoDelivery(ctx, s.entrega)].filter(Boolean).join("\n"),
    [notaCerrado(ctx, ahora), textoEntrega(ctx, s.entrega, s.direccion)].filter(Boolean).join(" "),
    textoPago(ctx),
    grande ? "Como es un pedido grande, una persona del equipo lo confirma contigo antes de prepararlo 🙏." : "",
  ].filter(Boolean).join("\n\n");

  const avisoDueno = [
    `🛒 Nuevo pedido ${cod}`,
    `Cliente: ${nombre ?? "sin nombre"} (${telefono})`,
    items.map((i) => `${i.cantidad} x ${i.nombre_producto}`).join("; "),
    `Total: ${precio(r.total_usd, tasa)} · ${s.entrega === "domicilio" ? `Domicilio: ${limpio(s.direccion, 200)}` : "Retiro en el local"}`,
    s.notas ? `Notas: ${limpio(s.notas, 300)}` : "",
    s.alerta ? `⚠️ Las notas mencionan «${s.alerta}»: revísalas.` : "",
    grande ? "⚠️ Pedido grande: confírmalo con el cliente antes de prepararlo." : "",
    "Confírmalo en tu panel → Pedidos.",
  ].filter(Boolean).join("\n");

  return { respuesta, avisoDueno, creado: true, pedidoId: r.pedido_id };
}

// Mensaje del menú web: «… [[PEDIDO v1|negocio=…|items=…|total=…|tasa=…|entrega=…]]».
export function leerPedidoDelMenu(texto: string):
  | { ok: true; slug: string; items: ItemPedido[]; entrega: "retiro" | "domicilio"; nombre: string; direccion: string; notas: string }
  | { ok: false; motivo: "varios" | "ilegible" } {
  const bloques = texto.match(/\[\[PEDIDO v\d+\|[^[\]]*\]\]/g) ?? [];
  if (bloques.length > 1) return { ok: false, motivo: "varios" };
  // Si el bloque quedó pegado a otro mensaje (los mensajes seguidos se juntan), se pone en su propia línea.
  const hallado = /\[\[PEDIDO v\d+\|[^[\]]*\]\]/.exec(texto);
  const ordenado = hallado ? `${texto.slice(0, hallado.index).replace(/[ \t]+$/, "")}\n${hallado[0]}` : texto;
  const p = parsearPedido(ordenado);
  if (!p.ok) return { ok: false, motivo: "ilegible" };
  return { ok: true, slug: p.negocio, items: p.items, entrega: p.entrega, nombre: p.nombre, direccion: p.direccion, notas: p.notas };
}
