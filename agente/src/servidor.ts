// Servidor HTTP del agente. Solo escucha dentro de la red de Docker: Evolution le manda los mensajes.
//   POST /webhook              mensajes de WhatsApp (exige el secreto)
//   POST /interno/avisos       procesa ya la cola de avisos (exige el secreto interno)
//   GET  /salud                para Docker
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";

const MAX_CUERPO = 30 * 1024 * 1024; // un audio o una foto en base64

export type Manejadores = {
  secretoWebhook: string;
  secretoInterno: string | null;
  webhook: (cuerpo: unknown) => Promise<void>;
  avisos: () => Promise<number>;
  log: (mensaje: string, extra?: Record<string, unknown>) => void;
};

export function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function secretoDe(req: IncomingMessage, url: URL): string {
  const cabecera = req.headers["x-webhook-secret"];
  return (Array.isArray(cabecera) ? cabecera[0] : cabecera) ?? url.searchParams.get("secreto") ?? "";
}

function leerCuerpo(req: IncomingMessage): Promise<string> {
  return new Promise((ok, mal) => {
    let tam = 0;
    const trozos: Buffer[] = [];
    req.on("data", (t: Buffer) => {
      tam += t.length;
      if (tam > MAX_CUERPO) {
        mal(new Error("demasiado grande"));
        req.destroy();
        return;
      }
      trozos.push(t);
    });
    req.on("end", () => ok(Buffer.concat(trozos).toString("utf8")));
    req.on("error", mal);
  });
}

const responder = (res: ServerResponse, estado: number, cuerpo: unknown) => {
  res.writeHead(estado, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
};

export function crearServidor(m: Manejadores) {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://agente");
    try {
      if (req.method === "GET" && url.pathname === "/salud") return responder(res, 200, { ok: true });

      if (req.method === "POST" && url.pathname === "/webhook") {
        if (!iguales(secretoDe(req, url), m.secretoWebhook)) return responder(res, 401, { ok: false });
        const cuerpo = JSON.parse(await leerCuerpo(req));
        // Se responde enseguida: Evolution no espera a que el agente termine de pensar.
        responder(res, 200, { ok: true });
        m.webhook(cuerpo).catch((e) => m.log("error en el webhook", { error: (e as Error).message }));
        return;
      }

      if (req.method === "POST" && url.pathname === "/interno/avisos") {
        if (!m.secretoInterno || !iguales(secretoDe(req, url), m.secretoInterno)) return responder(res, 401, { ok: false });
        return responder(res, 200, { ok: true, enviados: await m.avisos() });
      }

      return responder(res, 404, { ok: false });
    } catch (e) {
      if (!res.headersSent) responder(res, 400, { ok: false });
      m.log("petición rechazada", { ruta: url.pathname, error: (e as Error).message });
    }
  });
}
