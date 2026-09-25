import "server-only";

// Cliente de Evolution API (WhatsApp). SOLO servidor: usa una clave que puede gestionar TODAS las
// instancias, así que `server-only` hace fallar el build si algún componente de cliente lo importa.
//
// Variables de entorno (Vercel, nunca NEXT_PUBLIC_):
//   EVOLUTION_API_URL      https://evolution.tudominio.com   (https obligatorio; http solo en localhost)
//   EVOLUTION_API_KEY      clave global de Evolution
//   N8N_WEBHOOK_URL        webhook de n8n al que Evolution enviará los mensajes (opcional aquí)
//   N8N_WEBHOOK_SECRET     valor de la cabecera x-webhook-secret que n8n comprobará (opcional)
//
// Los endpoints siguen la documentación de Evolution API v2. Se verifican contra la instancia real.
// Ningún error devuelve ni registra la clave ni el cuerpo de la respuesta de Evolution.

export type CodigoError =
  | "no_configurado"
  | "no_alcanzable"
  | "tiempo_agotado"
  | "no_autorizado"
  | "no_encontrada"
  | "rechazado"
  | "respuesta_invalida";

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: CodigoError; mensaje: string };

const MENSAJES: Record<CodigoError, string> = {
  no_configurado: "La conexión con WhatsApp no está configurada en el servidor.",
  no_alcanzable: "No se pudo conectar con el servicio de WhatsApp. Inténtalo en unos minutos.",
  tiempo_agotado: "El servicio de WhatsApp tardó demasiado en responder. Inténtalo de nuevo.",
  no_autorizado: "El servidor no está autorizado en el servicio de WhatsApp.",
  no_encontrada: "Esta cuenta de WhatsApp todavía no está creada.",
  rechazado: "El servicio de WhatsApp rechazó la solicitud.",
  respuesta_invalida: "El servicio de WhatsApp respondió algo inesperado.",
};

const fallo = (error: CodigoError): { ok: false; error: CodigoError; mensaje: string } => ({
  ok: false,
  error,
  mensaje: MENSAJES[error],
});

export type EstadoWhatsApp = "conectado" | "conectando" | "desconectado" | "desconocido";

const NOMBRE_INSTANCIA = /^[a-z0-9][a-z0-9-]{0,62}$/;
const TIEMPO_MAXIMO_MS = 8000;
const TAMANO_MAXIMO = 500_000;

// Nombre determinista de la instancia de un local. Cabe en el formato que exige la base de datos.
export function nombreInstancia(slug: string): string {
  return `menu-${slug}`.slice(0, 63).replace(/-+$/, "");
}

export function instanciaValida(nombre: string): boolean {
  return NOMBRE_INSTANCIA.test(nombre);
}

function configuracion() {
  const bruta = process.env.EVOLUTION_API_URL?.trim();
  const clave = process.env.EVOLUTION_API_KEY?.trim();
  if (!bruta || !clave) return null;

  let url: URL;
  try {
    url = new URL(bruta);
  } catch {
    return null;
  }
  // La clave viaja en una cabecera: solo por https (http únicamente hacia localhost, para pruebas).
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;

  return {
    base: url.origin + url.pathname.replace(/\/+$/, ""),
    clave,
    webhookUrl: process.env.N8N_WEBHOOK_URL?.trim() || null,
    webhookSecreto: process.env.N8N_WEBHOOK_SECRET?.trim() || null,
  };
}

export function evolutionConfigurado(): boolean {
  return configuracion() !== null;
}

async function llamar(
  metodo: "GET" | "POST",
  ruta: string,
  cuerpo?: unknown,
): Promise<Resultado<{ json: unknown }>> {
  const cfg = configuracion();
  if (!cfg) return fallo("no_configurado");

  try {
    const r = await fetch(cfg.base + ruta, {
      method: metodo,
      headers: { apikey: cfg.clave, ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      redirect: "error", // nunca seguir una redirección con la clave en la cabecera
    });

    if (r.status === 401 || r.status === 403) return fallo("no_autorizado");
    if (r.status === 404) return fallo("no_encontrada");

    const texto = await r.text();
    if (texto.length > TAMANO_MAXIMO) return fallo("respuesta_invalida");
    if (!r.ok) {
      console.error(`Evolution ${metodo} ${ruta.split("?")[0]} -> HTTP ${r.status}`);
      return fallo("rechazado");
    }
    let json: unknown = null;
    try {
      json = JSON.parse(texto);
    } catch {
      /* algunas respuestas no traen cuerpo JSON */
    }
    return { ok: true, valor: { json } };
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return fallo("tiempo_agotado");
    return fallo("no_alcanzable");
  }
}

const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function leerEstado(json: unknown): EstadoWhatsApp {
  const raiz = objeto(json);
  const bruto = objeto(raiz.instance).state ?? raiz.state;
  switch (bruto) {
    case "open":
      return "conectado";
    case "connecting":
      return "conectando";
    case "close":
    case "closed":
      return "desconectado";
    default:
      return "desconocido";
  }
}

export async function estadoInstancia(nombre: string): Promise<Resultado<EstadoWhatsApp>> {
  if (!instanciaValida(nombre)) return fallo("rechazado");
  const r = await llamar("GET", `/instance/connectionState/${encodeURIComponent(nombre)}`);
  return r.ok ? { ok: true, valor: leerEstado(r.valor.json) } : r;
}

export type DatosQR = { estado: EstadoWhatsApp; qr: string | null; codigo: string | null };

// Pide a Evolution que (re)inicie la vinculación. Devuelve el QR como imagen (data URI) y el código de
// emparejamiento; solo se aceptan imágenes PNG en base64 y códigos alfanuméricos (nada arbitrario llega al navegador).
export async function obtenerQR(nombre: string): Promise<Resultado<DatosQR>> {
  if (!instanciaValida(nombre)) return fallo("rechazado");
  const r = await llamar("GET", `/instance/connect/${encodeURIComponent(nombre)}`);
  if (!r.ok) return r;

  const raiz = objeto(r.valor.json);
  const qr = typeof raiz.base64 === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(raiz.base64) && raiz.base64.length <= 200_000 ? raiz.base64 : null;
  const codigo = typeof raiz.pairingCode === "string" && /^[A-Za-z0-9-]{4,20}$/.test(raiz.pairingCode) ? raiz.pairingCode : null;
  if (qr || codigo) return { ok: true, valor: { estado: "desconectado", qr, codigo } };

  // Sin QR: normalmente porque ya está vinculada (Evolution responde con el estado).
  const estado = leerEstado(raiz);
  if (estado !== "desconocido") return { ok: true, valor: { estado, qr: null, codigo: null } };
  return fallo("respuesta_invalida");
}

export async function existeInstancia(nombre: string): Promise<Resultado<boolean>> {
  if (!instanciaValida(nombre)) return fallo("rechazado");
  const r = await llamar("GET", `/instance/fetchInstances?instanceName=${encodeURIComponent(nombre)}`);
  if (!r.ok) return r.error === "no_encontrada" ? { ok: true, valor: false } : r;

  const lista = Array.isArray(r.valor.json) ? r.valor.json : r.valor.json ? [r.valor.json] : [];
  const existe = lista.some((x) => {
    const o = objeto(x);
    return o.name === nombre || objeto(o.instance).instanceName === nombre || o.instanceName === nombre;
  });
  return { ok: true, valor: existe };
}

export async function crearInstancia(nombre: string): Promise<Resultado<null>> {
  if (!instanciaValida(nombre)) return fallo("rechazado");
  const cfg = configuracion();
  if (!cfg) return fallo("no_configurado");

  const webhook =
    cfg.webhookUrl
      ? {
          webhook: {
            url: cfg.webhookUrl,
            byEvents: false,
            base64: false,
            headers: cfg.webhookSecreto ? { "x-webhook-secret": cfg.webhookSecreto } : {},
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
          },
        }
      : {};

  const r = await llamar("POST", "/instance/create", {
    instanceName: nombre,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    ...webhook,
  });
  return r.ok ? { ok: true, valor: null } : r;
}

// Idempotente: si la instancia ya existe la reutiliza; si no, la crea. Devuelve si tuvo que crearla.
export async function asegurarInstancia(nombre: string): Promise<Resultado<{ creada: boolean }>> {
  const existe = await existeInstancia(nombre);
  if (!existe.ok) return existe;
  if (existe.valor) return { ok: true, valor: { creada: false } };

  const creada = await crearInstancia(nombre);
  if (creada.ok) return { ok: true, valor: { creada: true } };

  // Evolution responde 403 si el nombre ya está en uso (otra petición la creó a la vez): se vuelve a mirar.
  if (creada.error === "no_autorizado" || creada.error === "rechazado") {
    const otraVez = await existeInstancia(nombre);
    if (otraVez.ok && otraVez.valor) return { ok: true, valor: { creada: false } };
  }
  return creada;
}
