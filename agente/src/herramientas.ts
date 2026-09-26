// Herramientas que puede usar la IA. El modelo solo PROPONE (qué productos, qué cantidades); precios, totales,
// disponibilidad y a quién pertenece cada pedido los decide este código con la base de datos.
// El local, el cliente y su teléfono NUNCA los elige el modelo: vienen fijados desde la conversación.
import type { Deps } from "./flujo.ts";
import type { Herramienta } from "./ia.ts";
import { fechaLegible, leerFechaHora } from "./horario.ts";
import { resolverProducto } from "./menu.ts";
import { textoDelivery, textoEntrega } from "./pedidos.ts";
import type { Contacto, Contexto } from "./tipos.ts";
import { codigoPedido, formatUsd, limpio, precio } from "./texto.ts";
import { avisarDueno } from "./envio.ts";

export type EstadoTurno = { respuestaFija: string | null };

const ESTADO_LEGIBLE: Record<string, string> = {
  nuevo: "recibido (esperando confirmación del local)",
  confirmado: "confirmado",
  pagado: "pagado",
  listo: "listo",
  entregado: "entregado",
  cancelado: "cancelado",
};

const texto = (v: unknown, max: number) => (typeof v === "string" ? limpio(v, max) : "");

export function crearHerramientas(deps: Deps, ctx: Contexto, contacto: Contacto, estado: EstadoTurno, ultimoMensaje: string): Herramienta[] {
  const cliente = `${contacto.nombre ?? "Un cliente"} (${contacto.telefono ?? "sin número"})`;
  const telefono = contacto.telefono;
  const sinTelefono = "No puedo ver ni cambiar pedidos de este chat (WhatsApp no me dio su número). Usa pasar_a_humano.";

  const prepararPedido: Herramienta = {
    nombre: "preparar_pedido",
    descripcion:
      "Arma el pedido del cliente cuando ya sabes productos, cantidades y si retira en el local o es a domicilio (con dirección). " +
      "El sistema le muestra el resumen con el total real y le pide confirmación. Si el cliente cambia algo, vuelve a llamarla con la lista COMPLETA.",
    parametros: {
      type: "object",
      properties: {
        productos: {
          type: "array",
          minItems: 1,
          maxItems: 30,
          items: {
            type: "object",
            properties: {
              producto: { type: "string", description: "Nombre del producto tal como aparece en el menú" },
              cantidad: { type: "integer", minimum: 1, maximum: 999 },
            },
            required: ["producto", "cantidad"],
          },
        },
        entrega: { type: "string", enum: ["retiro", "domicilio"] },
        direccion: { type: "string", description: "Obligatoria si es a domicilio" },
        notas: { type: "string", description: "Indicaciones del cliente (opcional)" },
      },
      required: ["productos", "entrega"],
    },
    async ejecutar(a) {
      const lista = Array.isArray(a.productos) ? a.productos.slice(0, 30) : [];
      if (!lista.length) return "Error: faltan los productos.";
      const entrega = a.entrega === "domicilio" ? "domicilio" : a.entrega === "retiro" ? "retiro" : null;
      if (!entrega) return "Error: pregúntale si retira en el local o si es a domicilio.";
      if (entrega === "domicilio" && ctx.config.delivery_modo === "retiro") return "Este local solo tiene retiro en el local: díselo al cliente y pregúntale si lo pasa a buscar.";
      const direccion = texto(a.direccion, 200);
      if (entrega === "domicilio" && direccion.length < 5) return "Falta la dirección de entrega: pídesela.";

      const menu = await deps.menus.de(ctx.instancia);
      const items = new Map<string, { codigo: string; nombre: string; cantidad: number; precio_usd: number }>();
      const problemas: string[] = [];
      for (const bruto of lista) {
        const b = (bruto ?? {}) as Record<string, unknown>;
        const cantidad = Number(b.cantidad);
        const nombre = texto(b.producto, 80);
        if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 999) {
          problemas.push(`Cantidad no válida para «${nombre}».`);
          continue;
        }
        const r = resolverProducto(menu, nombre);
        if (!r.ok) {
          problemas.push(r.motivo === "ambiguo" ? `«${nombre}» puede ser: ${r.opciones.join(", ")}. Pregúntale cuál.` : `«${nombre}» no está en el menú.`);
          continue;
        }
        const p = r.producto;
        if (!p.disponible) {
          problemas.push(`${p.nombre} está agotado hoy.`);
          continue;
        }
        const previo = items.get(p.codigo)?.cantidad ?? 0;
        if (p.quedan !== null && previo + cantidad > p.quedan) {
          problemas.push(`De ${p.nombre} solo quedan ${p.quedan}.`);
          continue;
        }
        items.set(p.codigo, { codigo: p.codigo, nombre: p.nombre, cantidad: previo + cantidad, precio_usd: p.precio_usd });
      }
      if (problemas.length) return `No armé el pedido: ${problemas.join(" ")} Dile al cliente y ofrécele alternativas del menú.`;

      const lineas = [...items.values()];
      const total = Math.round(lineas.reduce((t, i) => t + i.cantidad * i.precio_usd, 0) * 100) / 100;
      const notas = texto(a.notas, 300) || null;
      deps.almacen.guardarBorrador(contacto.id, {
        items: lineas, entrega, direccion: entrega === "domicilio" ? direccion : null, notas, nombre: contacto.nombre, total_usd: total,
      });
      estado.respuestaFija = [
        "Tu pedido 📝",
        [
          ...lineas.map((i) => `• ${i.cantidad} x ${i.nombre} — ${formatUsd(i.cantidad * i.precio_usd)}`),
          `Total: ${precio(total, ctx.negocio.tasa_bs)}`,
          textoDelivery(ctx, entrega),
        ].filter(Boolean).join("\n"),
        [textoEntrega(ctx, entrega, direccion), notas ? `Notas: ${notas}` : ""].filter(Boolean).join("\n"),
        "¿Lo confirmo? Responde *sí* para registrarlo, o dime qué cambio.",
      ].join("\n\n");
      return "Listo: el sistema le mostró el resumen al cliente y espera su «sí». No repitas el resumen.";
    },
  };

  const verPedidos: Herramienta = {
    nombre: "ver_mis_pedidos",
    descripcion: "Los últimos pedidos de este cliente con su estado. Úsala si pregunta cómo va su pedido.",
    parametros: { type: "object", properties: {} },
    async ejecutar() {
      if (!telefono) return sinTelefono;
      const pedidos = await deps.supabase.pedidosCliente(ctx.instancia, telefono);
      if (!pedidos.length) return "Este cliente no tiene pedidos registrados.";
      return pedidos
        .map((p) => `${codigoPedido(p.codigo)} (${fechaLegible(p.creado)}): ${p.items.map((i) => `${i.cantidad} x ${i.nombre}`).join(", ")}; total ${formatUsd(p.total_usd)}; ${p.entrega}; estado: ${ESTADO_LEGIBLE[p.estado] ?? p.estado}.`)
        .join("\n");
    },
  };

  const cancelarPedido: Herramienta = {
    nombre: "cancelar_pedido",
    descripcion: "Cancela un pedido del cliente, solo si el local todavía no lo confirmó. Si no dice cuál y tiene uno solo sin confirmar, cancela ese.",
    parametros: { type: "object", properties: { codigo: { type: "string", description: "Código del pedido (8 caracteres), si el cliente lo dio" } } },
    async ejecutar(a) {
      if (!telefono) return sinTelefono;
      const pedidos = await deps.supabase.pedidosCliente(ctx.instancia, telefono);
      const pedido = String(a.codigo ?? "").replace(/[^0-9a-f]/gi, "").toLowerCase().slice(0, 8);
      let codigo = pedido;
      if (!codigo) {
        const nuevos = pedidos.filter((p) => p.estado === "nuevo");
        if (nuevos.length === 0) {
          const ultimo = pedidos[0];
          return ultimo ? `No hay pedidos sin confirmar. El último (${codigoPedido(ultimo.codigo)}) está ${ESTADO_LEGIBLE[ultimo.estado] ?? ultimo.estado}: para cancelarlo hace falta una persona (usa pasar_a_humano).` : "Este cliente no tiene pedidos.";
        }
        if (nuevos.length > 1) return `Tiene varios pedidos sin confirmar: ${nuevos.map((p) => codigoPedido(p.codigo)).join(", ")}. Pregúntale cuál.`;
        codigo = nuevos[0].codigo;
      }
      const r = await deps.supabase.cancelarPedido(ctx.instancia, telefono, codigo);
      if (r.ok) {
        deps.menus.invalidar(ctx.instancia);
        estado.respuestaFija = `Listo, cancelé tu pedido ${codigoPedido(codigo)} ✅. Si quieres pedir otra cosa, aquí estoy.`;
        await avisarDueno(deps, ctx, `❌ ${cliente} canceló su pedido ${codigoPedido(codigo)} por WhatsApp.`);
        return "Pedido cancelado; el sistema ya se lo dijo al cliente.";
      }
      if (r.error === "ya_en_proceso") return `No se puede: el pedido ya está ${ESTADO_LEGIBLE[r.estado ?? ""] ?? "en proceso"}. Usa pasar_a_humano para que una persona lo resuelva.`;
      return "No encontré ese pedido entre los suyos. Pregúntale el código o usa ver_mis_pedidos.";
    },
  };

  const registrarEncargo: Herramienta = {
    nombre: "registrar_encargo",
    descripcion:
      "Registra un encargo (torta, pedido especial) cuando ya tienes: qué quiere, fecha y hora, sabor/relleno y dedicatoria (si aplica), y si retira o es a domicilio. " +
      "El equipo le escribe para el precio y el anticipo.",
    parametros: {
      type: "object",
      properties: {
        descripcion: { type: "string", description: "Qué quiere (producto, tamaño o porciones)" },
        fecha_hora: { type: "string", description: "Para cuándo, como AAAA-MM-DD HH:MM (24 horas, hora de Venezuela)" },
        sabor_relleno: { type: "string" },
        dedicatoria: { type: "string" },
        entrega: { type: "string", enum: ["retiro", "domicilio"] },
        direccion: { type: "string" },
      },
      required: ["descripcion", "fecha_hora", "entrega"],
    },
    async ejecutar(a) {
      const descripcion = texto(a.descripcion, 300);
      if (descripcion.length < 3) return "Falta saber qué quiere encargar.";
      const cuando = leerFechaHora(String(a.fecha_hora ?? ""));
      if (!cuando) return "Error: fecha_hora debe ser AAAA-MM-DD HH:MM. Pregúntale la fecha y la hora exactas.";
      const horas = ctx.config.encargo_aviso_horas;
      if (cuando.getTime() - deps.ahora().getTime() < horas * 3600_000) {
        return `Los encargos se piden con al menos ${horas} horas de anticipación: la fecha más próxima es ${fechaLegible(new Date(deps.ahora().getTime() + horas * 3600_000))}. Díselo al cliente.`;
      }
      const entrega = a.entrega === "domicilio" ? "domicilio" : "retiro";
      if (entrega === "domicilio" && ctx.config.delivery_modo === "retiro") return "Este local solo tiene retiro en el local: díselo al cliente.";
      const direccion = texto(a.direccion, 200);
      if (entrega === "domicilio" && direccion.length < 5) return "Falta la dirección de entrega: pídesela.";
      const datos = {
        descripcion, fecha_hora: cuando.toISOString(), sabor_relleno: texto(a.sabor_relleno, 200), dedicatoria: texto(a.dedicatoria, 200),
        entrega, direccion: entrega === "domicilio" ? direccion : null, foto: deps.almacen.fotoReciente(contacto.id),
      };
      deps.almacen.guardarEncargo(contacto.id, datos);
      await avisarDueno(deps, ctx, [
        "🎂 Encargo nuevo",
        `Cliente: ${cliente}`,
        `Qué: ${descripcion}`,
        `Para: ${fechaLegible(cuando)}`,
        datos.sabor_relleno ? `Sabor/relleno: ${datos.sabor_relleno}` : "",
        datos.dedicatoria ? `Dedicatoria: ${datos.dedicatoria}` : "",
        entrega === "domicilio" ? `Domicilio: ${direccion}` : "Retira en el local",
        `Foto de referencia: ${datos.foto ? "sí (te la reenvié arriba)" : "no"}`,
        "Escríbele para darle el precio y el anticipo. El asistente no le escribirá por 24 horas.",
      ].filter(Boolean).join("\n"));
      deps.almacen.pausar(contacto.id, 24, "encargo");
      estado.respuestaFija = "¡Anotado! 🎂 Le pasé tu encargo al equipo; te escriben por aquí para confirmarte el precio y el anticipo.";
      return "Encargo enviado al equipo; el sistema ya se lo dijo al cliente.";
    },
  };

  const pasarAHumano: Herramienta = {
    nombre: "pasar_a_humano",
    descripcion: "Avisa a una persona del equipo: el cliente lo pide, hay un problema con un pedido o algo que no sabes resolver.",
    parametros: { type: "object", properties: { motivo: { type: "string" } }, required: ["motivo"] },
    async ejecutar(a) {
      await avisarDueno(deps, ctx, `🙋 ${cliente} necesita una persona: ${texto(a.motivo, 200) || "sin motivo"}\nÚltimo mensaje: «${limpio(ultimoMensaje, 300)}»`);
      deps.almacen.pausar(contacto.id, 3, "humano");
      estado.respuestaFija = "Le aviso a una persona del equipo; te escribe en cuanto pueda 🙏";
      return "Aviso enviado; el sistema ya se lo dijo al cliente.";
    },
  };

  return [prepararPedido, verPedidos, cancelarPedido, registrarEncargo, pasarAHumano];
}
