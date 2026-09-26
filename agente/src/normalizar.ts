// Convierte el evento de Evolution API v2 (messages.upsert) en un Entrante. Evolution manda varias formas de
// payload según la versión: se toman con cuidado y lo desconocido se ignora.
import type { Entrante } from "./tipos.ts";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");

const digitos = (jid: string) => jid.split("@")[0].split(":")[0].replace(/\D/g, "");

export function normalizar(cuerpo: unknown): Entrante | null {
  const b = obj(cuerpo);
  const evento = str(b.event).toLowerCase().replace(/_/g, ".");
  if (evento && evento !== "messages.upsert") return null;

  const data = obj(Array.isArray(b.data) ? b.data[0] : b.data);
  const key = obj(data.key);
  const instancia = str(b.instance) || str(b.instanceName);
  const messageId = str(key.id);
  if (!instancia || !messageId) return null;

  // WhatsApp identifica algunos chats con un id interno (…@lid) en lugar del número. Evolution a veces manda
  // los dos (remoteJid + remoteJidAlt) y a veces solo el LID.
  const candidatos = [str(key.remoteJid), str(key.remoteJidAlt), str(key.participant)].filter(Boolean);
  const jidTel = candidatos.find((j) => j.endsWith("@s.whatsapp.net")) ?? "";
  const jidLid = candidatos.find((j) => j.endsWith("@lid")) ?? "";
  const esGrupo = str(key.remoteJid).endsWith("@g.us");
  const telefono = jidTel ? digitos(jidTel) || null : null;
  const lid = jidLid ? digitos(jidLid) || null : null;
  const jid = jidTel || str(key.remoteJid);

  const numeroPropio = digitos(str(b.sender)) || null;
  const fromMe = key.fromMe === true;
  const esPanel = fromMe && !!numeroPropio && telefono === numeroPropio;

  const m = obj(data.message);
  let tipo: Entrante["tipo"] = "otro";
  let texto = "";
  let mimetype: string | null = null;
  if (typeof m.conversation === "string") {
    tipo = "texto";
    texto = m.conversation;
  } else if (m.extendedTextMessage) {
    tipo = "texto";
    texto = str(obj(m.extendedTextMessage).text);
  } else if (m.audioMessage) {
    tipo = "audio";
    mimetype = str(obj(m.audioMessage).mimetype) || "audio/ogg";
  } else if (m.imageMessage) {
    tipo = "imagen";
    texto = str(obj(m.imageMessage).caption);
    mimetype = str(obj(m.imageMessage).mimetype) || "image/jpeg";
  } else if (m.buttonsResponseMessage || m.listResponseMessage) {
    tipo = "texto";
    texto = str(obj(m.buttonsResponseMessage).selectedDisplayText) || str(obj(obj(m.listResponseMessage).singleSelectReply).selectedRowId);
  }

  const base64 = str(m.base64) || str(data.base64) || null;

  return {
    instancia,
    messageId,
    fromMe,
    esGrupo,
    telefono,
    lid,
    jid,
    numeroPropio,
    esPanel,
    nombrePush: str(data.pushName) || null,
    tipo,
    texto: texto.slice(0, 4000),
    base64: tipo === "audio" || tipo === "imagen" ? base64 : null,
    mimetype,
  };
}
