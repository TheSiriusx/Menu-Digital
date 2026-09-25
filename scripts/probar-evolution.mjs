// Pruebas del cliente de Evolution (src/lib/evolution.ts) contra la Evolution simulada.
// Uso: node scripts/probar-evolution.mjs
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { CLAVE_SIMULADA, iniciarSimulada } from "./evolution-simulada.mjs";

const raiz = fileURLToPath(new URL("..", import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), "evolution-"));
const fuente = readFileSync(`${raiz}src/lib/evolution.ts`, "utf8").replace('import "server-only";', ""); // fuera de Next no existe
writeFileSync(`${tmp}/evolution.mjs`, ts.transpileModule(fuente, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const E = await import(pathToFileURL(`${tmp}/evolution.mjs`));

const PUERTO = 4011;
const URL_SIM = `http://127.0.0.1:${PUERTO}`;
const { cerrar } = await iniciarSimulada(PUERTO);
const api = (ruta, cuerpo) => fetch(URL_SIM + ruta, { method: cuerpo ? "POST" : "GET", body: cuerpo ? JSON.stringify(cuerpo) : undefined }).then((r) => r.json());
const modo = (m) => api("/__modo", { modo: m });
const registro = () => api("/__registro");

let bien = 0, mal = 0;
const ok = (c, m) => { if (c) bien++; else mal++; console.log((c ? "OK    " : "FALLA ") + m); };
const configurar = (v = {}) => {
  const base = { EVOLUTION_API_URL: URL_SIM, EVOLUTION_API_KEY: CLAVE_SIMULADA, N8N_WEBHOOK_URL: "https://n8n.ejemplo.com/webhook/pedidos", N8N_WEBHOOK_SECRET: "secreto-webhook" };
  for (const k of Object.keys(base)) delete process.env[k];
  Object.assign(process.env, { ...base, ...v });
  for (const [k, val] of Object.entries(process.env)) if (val === undefined || val === "__quitar__") delete process.env[k];
};
const sinFuga = (r) => !JSON.stringify(r).includes(CLAVE_SIMULADA) && !JSON.stringify(r).includes("boom") && !JSON.stringify(r).includes("secretos");

console.log("--- configuración ---");
configurar({ EVOLUTION_API_URL: "__quitar__" });
ok(E.evolutionConfigurado() === false, "sin URL: no configurado");
configurar({ EVOLUTION_API_KEY: "__quitar__" });
ok(E.evolutionConfigurado() === false, "sin clave: no configurado");
configurar({ EVOLUTION_API_URL: "http://evolution.ejemplo.com" });
ok(E.evolutionConfigurado() === false, "http hacia un servidor real: rechazado (la clave no viaja sin cifrar)");
configurar({ EVOLUTION_API_URL: "ftp://x" });
ok(E.evolutionConfigurado() === false, "protocolo raro: rechazado");
configurar({ EVOLUTION_API_URL: "basura" });
ok(E.evolutionConfigurado() === false, "URL inválida: rechazada");
configurar();
ok(E.evolutionConfigurado() === true, "http hacia localhost (pruebas): permitido");
const sin = await (async () => { configurar({ EVOLUTION_API_KEY: "__quitar__" }); const r = await E.estadoInstancia("menu-x"); configurar(); return r; })();
ok(!sin.ok && sin.error === "no_configurado", "sin configuración, las llamadas devuelven no_configurado (no fallan con excepción)");

console.log("--- nombres de instancia ---");
ok(E.nombreInstancia("nueva-victoria") === "menu-nueva-victoria", "nombre = menu-{slug}");
const largo = E.nombreInstancia("a".repeat(60));
ok(largo.length <= 63 && E.instanciaValida(largo), `slug de 60 caracteres cabe en el límite de 63 (${largo.length})`);
ok(!E.instanciaValida("../../etc") && !E.instanciaValida("A B") && !E.instanciaValida("x?y=1") && !E.instanciaValida(""), "nombres con rutas, mayúsculas, espacios o parámetros son inválidos");
const raro = await E.estadoInstancia("../admin/instance/delete/otra");
ok(!raro.ok && raro.error === "rechazado" && (await registro()).length === 0, "un nombre malicioso NUNCA llega a Evolution (no sale ninguna petición)");

console.log("--- alta idempotente ---");
await api("/__reset", {});
let r = await E.existeInstancia("menu-nueva-victoria");
ok(r.ok && r.valor === false, "una instancia inexistente se detecta como no existente (404 -> false)");
r = await E.asegurarInstancia("menu-nueva-victoria");
ok(r.ok && r.valor.creada === true, "asegurar: la crea");
const reg = await registro();
const creacion = reg.find((x) => x.ruta === "/instance/create");
ok(creacion && creacion.apikey === CLAVE_SIMULADA, "la clave viaja en la cabecera apikey");
ok(creacion.cuerpo.instanceName === "menu-nueva-victoria" && creacion.cuerpo.integration === "WHATSAPP-BAILEYS", "cuerpo de creación: nombre e integración");
ok(creacion.cuerpo.webhook?.url === "https://n8n.ejemplo.com/webhook/pedidos" && creacion.cuerpo.webhook.headers["x-webhook-secret"] === "secreto-webhook" && creacion.cuerpo.webhook.events.includes("MESSAGES_UPSERT"), "el webhook hacia n8n lleva la URL, el secreto y el evento de mensajes");
r = await E.asegurarInstancia("menu-nueva-victoria");
ok(r.ok && r.valor.creada === false, "asegurar otra vez: la reutiliza, no crea otra");
ok((await registro()).filter((x) => x.ruta === "/instance/create").length === 1, "solo hubo UNA llamada de creación");
configurar({ N8N_WEBHOOK_URL: "__quitar__" });
await E.crearInstancia("menu-sin-webhook");
ok(!(await registro()).find((x) => x.cuerpo?.instanceName === "menu-sin-webhook").cuerpo.webhook, "sin N8N_WEBHOOK_URL no se manda webhook");
configurar();
await api("/__precrear/menu-preexistente", {});
r = await E.asegurarInstancia("menu-preexistente");
ok(r.ok && r.valor.creada === false, "una instancia que ya existía en Evolution se adopta sin crearla");

console.log("--- estado y QR ---");
r = await E.estadoInstancia("menu-nueva-victoria");
ok(r.ok && r.valor === "desconectado", "estado: desconectado");
let q = await E.obtenerQR("menu-nueva-victoria");
ok(q.ok && q.valor.qr?.startsWith("data:image/png;base64,") && q.valor.qr.length > 100, "QR: imagen PNG en base64");
const qr1 = q.valor.qr; q = await E.obtenerQR("menu-nueva-victoria");
ok(q.valor.qr !== qr1, "cada petición trae un QR nuevo (se renueva)");
r = await E.estadoInstancia("menu-nueva-victoria");
ok(r.ok && r.valor === "conectando", "tras pedir el QR el estado pasa a conectando");
await api("/__escanear/menu-nueva-victoria", {});
r = await E.estadoInstancia("menu-nueva-victoria");
ok(r.ok && r.valor === "conectado", "al escanear: conectado");
q = await E.obtenerQR("menu-nueva-victoria");
ok(q.ok && q.valor.estado === "conectado" && q.valor.qr === null, "pedir QR con la cuenta ya conectada devuelve el estado, sin QR");
await api("/__desvincular/menu-nueva-victoria", {});
r = await E.estadoInstancia("menu-nueva-victoria");
ok(r.ok && r.valor === "desconectado", "al desvincularse: vuelve a desconectado (y se puede reescanear)");
r = await E.estadoInstancia("menu-no-existe");
ok(!r.ok && r.error === "no_encontrada", "instancia inexistente: no_encontrada");

console.log("--- fallos del servidor de WhatsApp ---");
configurar({ EVOLUTION_API_KEY: "clave-equivocada" });
r = await E.estadoInstancia("menu-nueva-victoria");
ok(!r.ok && r.error === "no_autorizado" && sinFuga(r), "clave equivocada: no_autorizado, sin filtrar la clave");
configurar();
await modo("error500");
r = await E.estadoInstancia("menu-nueva-victoria");
ok(!r.ok && r.error === "rechazado" && sinFuga(r), "error 500: mensaje genérico, SIN detalles internos ni clave");
await modo("lento");
const t0 = Date.now(); r = await E.estadoInstancia("menu-nueva-victoria"); const dt = Date.now() - t0;
ok(!r.ok && r.error === "tiempo_agotado" && dt < 10000, `servidor lento: se corta a los 8 s (${(dt / 1000).toFixed(1)} s) con tiempo_agotado`);
await modo("redirect");
await api("/__reset", {}); await modo("redirect");
r = await E.estadoInstancia("menu-nueva-victoria");
ok(!r.ok && r.error === "no_alcanzable" && sinFuga(r), "redirección hostil: no se sigue (la clave no llega a otro servidor)");
await modo("basura");
q = await E.obtenerQR("menu-nueva-victoria");
ok(!q.ok || (q.valor.qr === null && q.valor.codigo === null), "respuesta con QR que no es PNG y código con <script>: NADA de eso llega al navegador");
r = await E.estadoInstancia("menu-nueva-victoria");
ok(r.ok && r.valor === "desconocido", "estado con formato raro: desconocido, sin romper");
await modo("ok");
await cerrar();
r = await E.estadoInstancia("menu-nueva-victoria");
ok(!r.ok && r.error === "no_alcanzable" && sinFuga(r), "servidor caído: no_alcanzable con mensaje claro");

console.log(`\n${bien} de ${bien + mal} pruebas correctas`);
process.exit(mal ? 1 : 0);
