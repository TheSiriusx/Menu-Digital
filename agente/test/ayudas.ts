// Dobles de prueba: Supabase, Evolution y la IA simulados, con registro de todo lo que se les pide.
import { Almacen } from "../src/almacen.ts";
import type { AvisoPendiente } from "../src/clientes.ts";
import { Contextos, crearCola, type Deps } from "../src/flujo.ts";
import type { Herramienta, MensajeIA, Modelo, RespuestaModelo } from "../src/ia.ts";
import { Menus } from "../src/menu.ts";
import type { ConfigAsistente, Contexto, PedidoCliente, ProductoMenu, ResultadoCrearPedido } from "../src/tipos.ts";

export const INSTANCIA = "menu-nueva-victoria";
export const PROPIO = "584120000000";   // el WhatsApp del local
export const CLIENTE = "999000000001";   // números de prueba: código 999, no existen

export const MENU: ProductoMenu[] = [
  { codigo: "aaaa0001", nombre: "Pan canilla", descripcion: "Crujiente", precio_usd: 0.5, disponible: true, categoria: "Panes", quedan: null },
  { codigo: "aaaa0002", nombre: "Pan sobado", descripcion: null, precio_usd: 0.3, disponible: true, categoria: "Panes", quedan: 3 },
  { codigo: "aaaa0003", nombre: "Golfeado", descripcion: null, precio_usd: 1.5, disponible: false, categoria: "Dulces", quedan: null },
  { codigo: "aaaa0004", nombre: "Torta de chocolate", descripcion: "Porción", precio_usd: 2.5, disponible: true, categoria: "Dulces", quedan: null },
  { codigo: "aaaa0005", nombre: "Tequeños x10", descripcion: null, precio_usd: 6, disponible: true, categoria: "Especiales", quedan: null },
];

const HORARIO = {
  lunes: [{ desde: "06:00", hasta: "19:00" }], martes: [{ desde: "06:00", hasta: "19:00" }], miercoles: [{ desde: "06:00", hasta: "19:00" }],
  jueves: [{ desde: "06:00", hasta: "19:00" }], viernes: [{ desde: "06:00", hasta: "19:00" }], sabado: [{ desde: "06:00", hasta: "19:00" }],
  domingo: [{ desde: "06:00", hasta: "13:00" }],
};

export function config(cambios: Partial<ConfigAsistente> = {}): ConfigAsistente {
  return {
    agente_activo: true, pausado_hasta: null, horario: HORARIO, acepta_fuera_horario: true,
    datos_pago: "Pago móvil: Banco X 0412-0000000", pago_momento: "al_registrar", delivery_modo: "tarifa", delivery_tarifa_usd: 2,
    delivery_texto: "", resena_url: "https://g.page/r/prueba", resena_espera_min: 120, telefono_dueno: null,
    recordatorio_1_min: 10, recordatorio_2_min: 30, stock_aviso_umbral: 5, encargo_aviso_horas: 48,
    pedido_grande_usd: 100, pedido_grande_unidades: 50, ...cambios,
  };
}

export class FakeSupabase {
  ctx: Contexto;
  menuActual = MENU;
  llamadas: { fn: string; args: unknown }[] = [];
  pedidos: PedidoCliente[] = [];
  avisos: AvisoPendiente[] = [];
  resultados: { id: number; ok: boolean; error: string | null }[] = [];
  respuestaCrear: ((a: Record<string, unknown>) => ResultadoCrearPedido) | null = null;

  constructor(cfg: Partial<ConfigAsistente> = {}, activo = true) {
    this.ctx = {
      instancia: INSTANCIA,
      negocio: { id: "neg-1", slug: "nueva-victoria", nombre: "Panadería Nueva Victoria", activo, tasa_bs: 50, telefono: PROPIO, horario: null },
      config: config(cfg),
    };
  }
  private reg(fn: string, args: unknown) {
    this.llamadas.push({ fn, args });
  }
  de(fn: string) {
    return this.llamadas.filter((l) => l.fn === fn).map((l) => l.args as Record<string, unknown>);
  }
  async contexto(instancia: string) {
    this.reg("contexto", { instancia });
    return instancia === INSTANCIA ? this.ctx : null;
  }
  async menu(instancia: string) {
    this.reg("menu", { instancia });
    return this.menuActual;
  }
  async crearPedido(a: Record<string, unknown> & { items: { codigo: string; cantidad: number }[] }): Promise<ResultadoCrearPedido> {
    this.reg("crearPedido", a);
    if (this.respuestaCrear) return this.respuestaCrear(a);
    const items = a.items.map((i) => {
      const p = MENU.find((m) => m.codigo === i.codigo)!;
      return { codigo: i.codigo, nombre_producto: p.nombre, cantidad: i.cantidad, precio_unitario_usd: p.precio_usd };
    });
    const total = Math.round(items.reduce((t, i) => t + i.cantidad * i.precio_unitario_usd, 0) * 100) / 100;
    return { ok: true, duplicado: false, pedido_id: "c0ffee01-0000-4000-8000-000000000001", total_usd: total, tasa_bs: 50, items };
  }
  async pedidosCliente(instancia: string, telefono: string) {
    this.reg("pedidosCliente", { instancia, telefono });
    return this.pedidos;
  }
  async cancelarPedido(instancia: string, telefono: string, codigo: string) {
    this.reg("cancelarPedido", { instancia, telefono, codigo });
    const p = this.pedidos.find((x) => x.codigo === codigo);
    if (!p) return { ok: false as const, error: "pedido_no_encontrado" };
    if (p.estado !== "nuevo") return { ok: false as const, error: "ya_en_proceso", estado: p.estado };
    p.estado = "cancelado";
    return { ok: true as const, codigo };
  }
  async pedidosHoy(instancia: string) {
    this.reg("pedidosHoy", { instancia });
    return [{ codigo: "c0ffee01", estado: "nuevo", total_usd: 3.5, entrega: "retiro", nombre: "Ana", telefono: CLIENTE, creado: "2026-09-28T14:00:00Z" }];
  }
  async encendido(instancia: string, modo: "apagar" | "encender", horas: number | null) {
    this.reg("encendido", { instancia, modo, horas });
    return { ok: true as const, agente_activo: modo === "encender" || horas !== null, pausado_hasta: horas ? "2026-09-28T17:00:00Z" : null };
  }
  async avisosTomar() {
    const a = this.avisos;
    this.avisos = [];
    return a;
  }
  async avisoResultado(id: number, ok: boolean, error: string | null = null) {
    this.resultados.push({ id, ok, error });
  }
}

export class FakeEvolution {
  enviados: { instancia: string; destino: string; texto: string; imagen?: boolean }[] = [];
  private n = 0;
  async enviarTexto(instancia: string, destino: string, texto: string) {
    this.enviados.push({ instancia, destino, texto });
    return `ENVIADO${++this.n}`;
  }
  async escribiendo() {}
  async enviarImagen(instancia: string, destino: string, _b64: string, _mime: string, caption: string) {
    this.enviados.push({ instancia, destino, texto: caption, imagen: true });
    return `ENVIADO${++this.n}`;
  }
  async descargarMedia() {
    return { base64: "QUJD", mimetype: "image/jpeg" };
  }
  a(destino: string) {
    return this.enviados.filter((e) => e.destino.replace(/\D/g, "") === destino.replace(/\D/g, "")).map((e) => e.texto).join("\n---\n");
  }
}

// IA con un guion: cada llamada devuelve la siguiente respuesta. Registra lo que recibió.
export class FakeModelo implements Modelo {
  guion: (RespuestaModelo | Error)[] = [];
  recibido: MensajeIA[][] = [];
  async completar(mensajes: MensajeIA[], _h: Herramienta[]): Promise<RespuestaModelo> {
    this.recibido.push(mensajes);
    const r = this.guion.shift();
    if (!r) return { contenido: "¡Hola! ¿En qué te ayudo? 😊", llamadas: [] };
    if (r instanceof Error) throw r;
    return r;
  }
}

export const llamada = (nombre: string, args: unknown, id = "t1") => ({
  contenido: null,
  llamadas: [{ id, type: "function" as const, function: { name: nombre, arguments: JSON.stringify(args) } }],
});

// Lunes 28/09/2026 10:00 en Caracas (abierto).
export const LUNES_10 = new Date("2026-09-28T14:00:00Z");

export function montar(opciones: { cfg?: Partial<ConfigAsistente>; activo?: boolean; ahora?: Date; whisper?: string | null } = {}) {
  const supabase = new FakeSupabase(opciones.cfg, opciones.activo ?? true);
  const evolution = new FakeEvolution();
  const modelo = new FakeModelo();
  let ahora = opciones.ahora ?? LUNES_10;
  const reloj = () => ahora;
  const logs: string[] = [];
  const deps: Deps = {
    almacen: new Almacen(":memory:", reloj),
    supabase: supabase as unknown as Deps["supabase"],
    evolution: evolution as unknown as Deps["evolution"],
    whisper: opciones.whisper === undefined ? null : { transcribir: async () => opciones.whisper ?? null },
    modelo,
    menus: new Menus(supabase, reloj),
    contextos: new Contextos(supabase, reloj),
    ahora: reloj,
    dormir: async () => {},
    log: (m) => logs.push(m),
    menuUrlBase: "https://menu.ejemplo",
  };
  const cola = crearCola(deps, 5);
  return { deps, cola, supabase, evolution, modelo, logs, avanzar: (ms: number) => (ahora = new Date(ahora.getTime() + ms)) };
}

let seq = 0;
// Evento de Evolution tal como llega al webhook.
export function evento(texto: string, o: { de?: string; fromMe?: boolean; id?: string; lidSolo?: string; tipo?: "texto" | "audio" | "imagen"; caption?: string; nombre?: string } = {}) {
  const de = o.de ?? CLIENTE;
  const key: Record<string, unknown> = { remoteJid: `${de}@s.whatsapp.net`, fromMe: !!o.fromMe, id: o.id ?? `MSG${++seq}` };
  if (o.lidSolo) {
    key.remoteJid = `${o.lidSolo}@lid`;
  }
  const message =
    o.tipo === "audio" ? { audioMessage: { mimetype: "audio/ogg" }, base64: "QUJD" }
      : o.tipo === "imagen" ? { imageMessage: { mimetype: "image/jpeg", caption: o.caption ?? "" }, base64: "QUJD" }
        : { conversation: texto };
  return { event: "messages.upsert", instance: INSTANCIA, sender: `${PROPIO}@s.whatsapp.net`, data: { key, pushName: o.nombre ?? "Ana", message } };
}

export const BLOQUE = (items = "aaaa0001x2,aaaa0004x1", entrega = "retiro", negocio = "nueva-victoria") =>
  `[[PEDIDO v1|negocio=${negocio}|items=${items}|total=0.01|tasa=1|entrega=${entrega}]]`;
