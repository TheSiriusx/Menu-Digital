// Evolution API SIMULADA (forma de la API v2) para probar la integración sin depender del servidor real.
// Uso:  node scripts/evolution-simulada.mjs [puerto]        (por defecto 4010; clave de la API: "clave-de-prueba")
// También se puede importar: import { iniciarSimulada } from "./evolution-simulada.mjs".
//
// API que imita (con cabecera apikey):
//   POST /instance/create                   GET /instance/fetchInstances?instanceName=x
//   GET  /instance/connectionState/{x}      GET /instance/connect/{x}
// Control para las pruebas (sin clave):
//   POST /__escanear/{x}   /__desvincular/{x}   /__modo {"modo":"ok|error500|lento|redirect|basura"}
//   GET  /__registro       POST /__reset        POST /__precrear/{x}
import { createServer } from "node:http";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

export const CLAVE_SIMULADA = "clave-de-prueba";

// PNG de 48x48 de un color que cambia en cada llamada (imita un QR que se renueva).
const tabla = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = tabla[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const trozo = (tipo, datos) => { const t = Buffer.from(tipo), l = Buffer.alloc(4), c = Buffer.alloc(4); l.writeUInt32BE(datos.length); c.writeUInt32BE(crc(Buffer.concat([t, datos]))); return Buffer.concat([l, t, datos, c]); };
function png(semilla) {
  const w = 48, fila = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { fila[1 + x * 3] = (semilla * 37) % 256; fila[2 + x * 3] = (x * 5 + semilla * 11) % 256; fila[3 + x * 3] = 120; }
  const datos = Buffer.concat(Array.from({ length: w }, () => fila));
  const cab = Buffer.alloc(13); cab.writeUInt32BE(w, 0); cab.writeUInt32BE(w, 4); cab[8] = 8; cab[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo("IHDR", cab), trozo("IDAT", deflateSync(datos)), trozo("IEND", Buffer.alloc(0))]);
}

export function iniciarSimulada(puerto = 4010) {
  let instancias = new Map(); // nombre -> { estado, cuerpoCreacion, qr }
  let registro = [];
  let modo = "ok";
  let contador = 0;

  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const partes = url.pathname.split("/").filter(Boolean);
    const cuerpoTexto = await new Promise((ok) => { let t = ""; req.on("data", (c) => (t += c)); req.on("end", () => ok(t)); });
    let cuerpo = null; try { cuerpo = cuerpoTexto ? JSON.parse(cuerpoTexto) : null; } catch { /* sin json */ }
    const responder = (estado, json) => { res.writeHead(estado, { "Content-Type": "application/json" }); res.end(JSON.stringify(json)); };

    // ----- control para las pruebas
    if (partes[0] === "__modo") { modo = cuerpo?.modo ?? "ok"; return responder(200, { modo }); }
    if (partes[0] === "__registro") return responder(200, registro);
    if (partes[0] === "__reset") { instancias = new Map(); registro = []; modo = "ok"; contador = 0; return responder(200, { ok: true }); }
    if (partes[0] === "__precrear") { instancias.set(partes[1], { estado: "close", cuerpoCreacion: null }); return responder(200, { ok: true }); }
    if (partes[0] === "__escanear") { const i = instancias.get(partes[1]); if (i) i.estado = "open"; return responder(200, { ok: !!i }); }
    if (partes[0] === "__desvincular") { const i = instancias.get(partes[1]); if (i) i.estado = "close"; return responder(200, { ok: !!i }); }

    // ----- API de Evolution
    registro.push({ metodo: req.method, ruta: url.pathname + url.search, apikey: req.headers.apikey ?? null, cuerpo });
    if (req.headers.apikey !== CLAVE_SIMULADA) return responder(401, { status: 401, error: "Unauthorized", response: { message: "Unauthorized" } });

    if (modo === "error500") return responder(500, { status: 500, error: "Internal", response: { message: "boom detalles-internos-secretos clave-de-prueba" } });
    if (modo === "lento") { await new Promise((r) => setTimeout(r, 12000)); return responder(200, {}); }
    if (modo === "redirect") { res.writeHead(302, { Location: "http://evil.example/robar" }); return res.end(); }
    if (modo === "basura") {
      if (partes[1] === "connect") return responder(200, { base64: "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==", pairingCode: "<script>alert(1)</script>" });
      if (partes[1] === "connectionState") return responder(200, { instance: { state: { raro: true } } });
      return responder(200, "no es json");
    }

    if (req.method === "POST" && url.pathname === "/instance/create") {
      const nombre = cuerpo?.instanceName;
      if (!nombre) return responder(400, { status: 400, error: "Bad Request" });
      if (instancias.has(nombre)) return responder(403, { status: 403, error: "Forbidden", response: { message: [`This name "${nombre}" is already in use.`] } });
      instancias.set(nombre, { estado: "close", cuerpoCreacion: cuerpo });
      return responder(201, { instance: { instanceName: nombre, status: "created" }, hash: "h", qrcode: { base64: "data:image/png;base64," + png(++contador).toString("base64") } });
    }
    if (req.method === "GET" && url.pathname === "/instance/fetchInstances") {
      const nombre = url.searchParams.get("instanceName");
      return instancias.has(nombre)
        ? responder(200, [{ id: "1", name: nombre, connectionStatus: instancias.get(nombre).estado }])
        : responder(404, { status: 404, error: "Not Found", response: { message: [`The "${nombre}" instance does not exist`] } });
    }
    if (req.method === "GET" && partes[0] === "instance" && partes[1] === "connectionState") {
      const i = instancias.get(partes[2]);
      return i ? responder(200, { instance: { instanceName: partes[2], state: i.estado } }) : responder(404, { status: 404, error: "Not Found" });
    }
    if (req.method === "GET" && partes[0] === "instance" && partes[1] === "connect") {
      const i = instancias.get(partes[2]);
      if (!i) return responder(404, { status: 404, error: "Not Found" });
      if (i.estado === "open") return responder(200, { instance: { instanceName: partes[2], state: "open" } });
      i.estado = "connecting";
      return responder(200, { pairingCode: null, code: "2@simulado", base64: "data:image/png;base64," + png(++contador).toString("base64"), count: contador });
    }
    return responder(404, { status: 404, error: "Not Found" });
  });

  return new Promise((ok) => servidor.listen(puerto, "127.0.0.1", () => ok({ puerto, cerrar: () => new Promise((r) => servidor.close(r)) })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { puerto } = await iniciarSimulada(Number(process.argv[2]) || 4010);
  console.log(`Evolution simulada en http://127.0.0.1:${puerto} (clave: ${CLAVE_SIMULADA}). Ctrl+C para salir.`);
}
