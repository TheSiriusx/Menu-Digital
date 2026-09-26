// Arranque del agente: configuración, servicios, servidor HTTP y la vuelta periódica de avisos.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Almacen } from "./almacen.ts";
import { procesarAvisos } from "./avisos.ts";
import { Evolution, Supabase, Whisper } from "./clientes.ts";
import { leerConfiguracion } from "./config.ts";
import { Contextos, crearCola, recibir, type Deps } from "./flujo.ts";
import { OpenRouter } from "./ia.ts";
import { Menus } from "./menu.ts";
import { crearServidor } from "./servidor.ts";

const log = (mensaje: string, extra?: Record<string, unknown>) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), mensaje, ...extra }));

const cfg = leerConfiguracion();
if (cfg.bd !== ":memory:") mkdirSync(dirname(cfg.bd), { recursive: true });

const supabase = new Supabase(cfg.supabaseUrl, cfg.supabaseClave);
const deps: Deps = {
  almacen: new Almacen(cfg.bd),
  supabase,
  evolution: new Evolution(cfg.evolutionUrl, cfg.evolutionClave),
  whisper: cfg.whisperUrl ? new Whisper(cfg.whisperUrl) : null,
  modelo: new OpenRouter(cfg.openrouterClave, cfg.modelos),
  menus: new Menus(supabase),
  contextos: new Contextos(supabase),
  ahora: () => new Date(),
  dormir: (ms) => new Promise((r) => setTimeout(r, ms)),
  log,
  menuUrlBase: cfg.menuUrlBase,
};
const cola = crearCola(deps, cfg.esperaMs);

let avisando = false;
const avisos = async () => {
  if (avisando) return 0;
  avisando = true;
  try {
    return await procesarAvisos(deps);
  } catch (e) {
    log("error procesando avisos", { error: (e as Error).message });
    return 0;
  } finally {
    avisando = false;
  }
};

const servidor = crearServidor({
  secretoWebhook: cfg.secretoWebhook,
  secretoInterno: cfg.secretoInterno,
  webhook: (cuerpo) => recibir(deps, cola, cuerpo),
  avisos,
  log,
});
servidor.listen(cfg.puerto, () => log("agente escuchando", { puerto: cfg.puerto, modelos: cfg.modelos, whisper: !!cfg.whisperUrl }));

const reloj = setInterval(() => void avisos(), cfg.avisosCadaMs);
const poda = setInterval(() => deps.almacen.podar(), 24 * 3600_000);

async function apagar() {
  log("apagando");
  clearInterval(reloj);
  clearInterval(poda);
  servidor.close();
  await cola.vaciar();
  process.exit(0);
}
process.on("SIGTERM", apagar);
process.on("SIGINT", apagar);
