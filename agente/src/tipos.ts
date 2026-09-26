import type { ConfigAsistente } from "../../src/lib/asistente.ts";

export type { ConfigAsistente };

export type Negocio = {
  id: string;
  slug: string;
  nombre: string;
  activo: boolean;
  tasa_bs: number;
  telefono: string | null;   // WhatsApp del local configurado en el menú
  horario: string | null;    // texto libre del menú (el estructurado está en la configuración)
};

// Todo lo que el agente sabe del local por el que llegó un mensaje (sale de la instancia de WhatsApp).
export type Contexto = { instancia: string; negocio: Negocio; config: ConfigAsistente };

export type ProductoMenu = {
  codigo: string;              // 8 primeros caracteres del id (lo que acepta crear_pedido)
  nombre: string;
  descripcion: string | null;
  precio_usd: number;
  disponible: boolean;
  categoria: string | null;
  quedan: number | null;       // solo cuando quedan pocas unidades
};

export type PedidoCliente = {
  codigo: string;
  estado: string;
  total_usd: number;
  entrega: "retiro" | "domicilio";
  creado: string;
  items: { nombre: string; cantidad: number }[];
};

export type ItemPedido = { codigo: string; cantidad: number };

export type ResultadoCrearPedido =
  | {
      ok: true;
      duplicado: boolean;
      pedido_id: string;
      total_usd: number;
      tasa_bs?: number;
      items?: { codigo: string; nombre_producto: string; cantidad: number; precio_unitario_usd: number }[];
    }
  | { ok: false; error: string; detalle?: Record<string, unknown> };

// Mensaje de WhatsApp ya interpretado (Evolution API v2, evento messages.upsert).
export type Entrante = {
  instancia: string;
  messageId: string;
  fromMe: boolean;
  esGrupo: boolean;
  telefono: string | null;     // número real, si vino
  lid: string | null;          // identificador interno de WhatsApp (…@lid), si vino
  jid: string;                 // a dónde responder
  numeroPropio: string | null; // el WhatsApp del local (campo sender)
  esPanel: boolean;            // el dueño escribiéndose a sí mismo
  nombrePush: string | null;
  tipo: "texto" | "audio" | "imagen" | "otro";
  texto: string;
  base64: string | null;
  mimetype: string | null;
};

export type Contacto = { id: number; instancia: string; telefono: string | null; lid: string | null; nombre: string | null; jid: string };

export type Rol = "cliente" | "asistente" | "equipo";
