// Clientes de los servicios externos: Supabase (menú y pedidos), Evolution API (WhatsApp) y Whisper (audios).
// Todos con tiempo máximo, sin seguir redirecciones (una clave nunca viaja a otro servidor) y sin poner
// claves ni respuestas internas en los errores.
import type { Contexto, PedidoCliente, ProductoMenu, ResultadoCrearPedido } from "./tipos.ts";
import { normalizarAsistente } from "../../src/lib/asistente.ts";

export class ErrorServicio extends Error {
  readonly servicio: string;
  readonly estado: number | null;
  constructor(servicio: string, estado: number | null, mensaje: string) {
    super(`${servicio}: ${mensaje}`);
    this.servicio = servicio;
    this.estado = estado;
  }
}

type Fetch = typeof fetch;

async function pedirJson(
  f: Fetch,
  servicio: string,
  url: string,
  opciones: { metodo?: string; cabeceras?: Record<string, string>; cuerpo?: unknown; ms?: number; formulario?: FormData },
): Promise<unknown> {
  let r: Response;
  try {
    r = await f(url, {
      method: opciones.metodo ?? (opciones.cuerpo || opciones.formulario ? "POST" : "GET"),
      headers: { ...(opciones.formulario ? {} : { "Content-Type": "application/json" }), ...opciones.cabeceras },
      body: opciones.formulario ?? (opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo)),
      redirect: "error",
      signal: AbortSignal.timeout(opciones.ms ?? 15000),
    });
  } catch (e) {
    const nombre = (e as Error).name;
    throw new ErrorServicio(servicio, null, nombre === "TimeoutError" ? "tiempo agotado" : "no alcanzable");
  }
  const texto = await r.text();
  if (!r.ok) throw new ErrorServicio(servicio, r.status, `respondió ${r.status}`);
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

// ---------------------------------------------------------------- Supabase (funciones agente_* y crear_pedido)
export class Supabase {
  private url: string;
  private clave: string;
  private f: Fetch;
  constructor(url: string, claveServicio: string, f: Fetch = fetch) {
    this.url = url.replace(/\/+$/, "");
    this.clave = claveServicio;
    this.f = f;
  }

  rpc(nombre: string, args: Record<string, unknown>, ms = 15000): Promise<unknown> {
    return pedirJson(this.f, "supabase", `${this.url}/rest/v1/rpc/${nombre}`, {
      cuerpo: args,
      cabeceras: { apikey: this.clave, Authorization: `Bearer ${this.clave}` },
      ms,
    });
  }

  async contexto(instancia: string): Promise<Contexto | null> {
    const r = (await this.rpc("agente_contexto", { p_instancia: instancia })) as {
      ok: boolean;
      negocio?: Record<string, unknown>;
      config?: Record<string, unknown> | null;
    };
    if (!r?.ok || !r.negocio || !r.config) return null;
    const n = r.negocio;
    return {
      instancia,
      negocio: {
        id: String(n.id),
        slug: String(n.slug),
        nombre: String(n.nombre),
        activo: n.activo === true,
        tasa_bs: Number(n.tasa_bs) || 0,
        telefono: (n.telefono as string | null) ?? null,
        horario: (n.horario as string | null) ?? null,
      },
      config: normalizarAsistente(r.config),
    };
  }

  async menu(instancia: string): Promise<ProductoMenu[]> {
    const r = (await this.rpc("agente_menu", { p_instancia: instancia })) as ProductoMenu[];
    return (r ?? []).map((p) => ({ ...p, precio_usd: Number(p.precio_usd), quedan: p.quedan === null ? null : Number(p.quedan) }));
  }

  async crearPedido(a: {
    instancia: string; slug: string; telefono: string; nombre: string | null; items: { codigo: string; cantidad: number }[];
    entrega: "retiro" | "domicilio"; direccion: string | null; notas: string | null; origen: string;
  }): Promise<ResultadoCrearPedido> {
    const r = (await this.rpc("crear_pedido", {
      p_instancia: a.instancia, p_slug: a.slug, p_telefono: a.telefono, p_nombre: a.nombre, p_items: a.items,
      p_metodo_pago: null, p_entrega: a.entrega, p_direccion: a.direccion, p_notas: a.notas, p_origen_mensaje_id: a.origen,
    }, 20000)) as ResultadoCrearPedido;
    if (r.ok) {
      return {
        ...r,
        total_usd: Number(r.total_usd),
        tasa_bs: r.tasa_bs === undefined ? undefined : Number(r.tasa_bs),
        items: r.items?.map((i) => ({ ...i, cantidad: Number(i.cantidad), precio_unitario_usd: Number(i.precio_unitario_usd) })),
      };
    }
    return r;
  }

  async pedidosCliente(instancia: string, telefono: string): Promise<PedidoCliente[]> {
    const r = (await this.rpc("agente_pedidos_cliente", { p_instancia: instancia, p_telefono: telefono })) as PedidoCliente[];
    return (r ?? []).map((p) => ({ ...p, total_usd: Number(p.total_usd) }));
  }

  cancelarPedido(instancia: string, telefono: string, codigo: string) {
    return this.rpc("agente_cancelar_pedido", { p_instancia: instancia, p_telefono: telefono, p_codigo: codigo }) as Promise<
      { ok: true; codigo: string } | { ok: false; error: string; estado?: string }
    >;
  }

  async pedidosHoy(instancia: string) {
    const r = (await this.rpc("agente_pedidos_hoy", { p_instancia: instancia })) as {
      codigo: string; estado: string; total_usd: number; entrega: string; nombre: string | null; telefono: string; creado: string;
    }[];
    return (r ?? []).map((p) => ({ ...p, total_usd: Number(p.total_usd) }));
  }

  encendido(instancia: string, modo: "apagar" | "encender", horas: number | null) {
    return this.rpc("agente_encendido", { p_instancia: instancia, p_modo: modo, p_horas: horas }) as Promise<
      { ok: true; agente_activo: boolean; pausado_hasta: string | null } | { ok: false; error: string }
    >;
  }

  async avisosTomar(limite = 20): Promise<AvisoPendiente[]> {
    return ((await this.rpc("agente_avisos_tomar", { p_limite: limite })) as AvisoPendiente[]) ?? [];
  }

  async avisoResultado(id: number, ok: boolean, error: string | null = null) {
    await this.rpc("agente_aviso_resultado", { p_id: id, p_ok: ok, p_error: error });
  }
}

export type AvisoPendiente = {
  id: number;
  clave: string;
  instancia: string | null;
  negocio: { nombre: string; slug: string; activo: boolean; tasa_bs: number; telefono: string | null };
  config: Record<string, unknown> | null;
  pedido: {
    codigo: string; estado: string; total_usd: number; entrega: "retiro" | "domicilio"; direccion: string | null;
    telefono: string; nombre: string | null; creado: string;
    items: { nombre: string; cantidad: number; precio_unitario_usd: number }[];
  };
};

// ---------------------------------------------------------------- Evolution API v2
export class Evolution {
  private url: string;
  private clave: string;
  private f: Fetch;
  constructor(url: string, clave: string, f: Fetch = fetch) {
    this.url = url.replace(/\/+$/, "");
    this.clave = clave;
    this.f = f;
  }

  private llamar(ruta: string, cuerpo: unknown, ms = 20000) {
    return pedirJson(this.f, "evolution", `${this.url}${ruta}`, { cuerpo, cabeceras: { apikey: this.clave }, ms });
  }

  // Número (solo dígitos) o jid completo (…@lid): Evolution acepta los dos.
  private static destino(d: string) {
    return d.includes("@") ? d : d.replace(/\D/g, "");
  }

  // Devuelve el id del mensaje enviado (para reconocerlo cuando vuelva como «fromMe»).
  async enviarTexto(instancia: string, destino: string, texto: string): Promise<string | null> {
    const r = (await this.llamar(`/message/sendText/${encodeURIComponent(instancia)}`, {
      number: Evolution.destino(destino),
      text: texto,
      linkPreview: false,
    })) as { key?: { id?: string } } | null;
    return r?.key?.id ?? null;
  }

  async escribiendo(instancia: string, destino: string, ms: number) {
    await this.llamar(`/chat/sendPresence/${encodeURIComponent(instancia)}`, {
      number: Evolution.destino(destino),
      delay: Math.round(ms),
      presence: "composing",
    }, ms + 10000);
  }

  async enviarImagen(instancia: string, destino: string, base64: string, mimetype: string, caption: string): Promise<string | null> {
    const r = (await this.llamar(`/message/sendMedia/${encodeURIComponent(instancia)}`, {
      number: Evolution.destino(destino),
      mediatype: "image",
      mimetype,
      media: base64.replace(/^data:[^,]+,/, ""),
      caption,
      fileName: "imagen.jpg",
    }, 40000)) as { key?: { id?: string } } | null;
    return r?.key?.id ?? null;
  }

  // Si el webhook no trajo el archivo, se descarga (audios e imágenes).
  async descargarMedia(instancia: string, messageId: string): Promise<{ base64: string; mimetype: string } | null> {
    const r = (await this.llamar(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instancia)}`, {
      message: { key: { id: messageId } },
      convertToMp4: false,
    }, 40000)) as { base64?: string; mimetype?: string } | null;
    return r?.base64 ? { base64: r.base64, mimetype: r.mimetype ?? "application/octet-stream" } : null;
  }
}

// ---------------------------------------------------------------- Whisper (contenedor local)
export class Whisper {
  private url: string;
  private f: Fetch;
  constructor(url: string, f: Fetch = fetch) {
    this.url = url.replace(/\/+$/, "");
    this.f = f;
  }

  async transcribir(base64: string, mimetype: string): Promise<string | null> {
    const bytes = Buffer.from(base64.replace(/^data:[^,]+,/, ""), "base64");
    if (bytes.length === 0 || bytes.length > 15 * 1024 * 1024) return null;
    const formulario = new FormData();
    formulario.append("audio_file", new Blob([bytes], { type: mimetype }), "audio.ogg");
    const r = await pedirJson(this.f, "whisper", `${this.url}/asr?task=transcribe&language=es&output=txt&encode=true`, {
      formulario,
      ms: 120000,
    });
    const texto = typeof r === "string" ? r : typeof (r as { text?: unknown })?.text === "string" ? String((r as { text: string }).text) : "";
    return texto.trim() || null;
  }
}
