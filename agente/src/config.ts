// Variables de entorno del agente. Las claves solo viven en agente/.env (nunca en el repositorio).
export type Configuracion = {
  puerto: number;
  secretoWebhook: string;       // lo exige /webhook (cabecera x-webhook-secret o ?secreto=)
  secretoInterno: string | null;// /interno/* (tareas programadas, p. ej. n8n)
  supabaseUrl: string;
  supabaseClave: string;        // clave de servicio: SOLO aquí
  evolutionUrl: string;
  evolutionClave: string;
  openrouterClave: string;
  modelos: string[];
  whisperUrl: string | null;
  bd: string;                   // archivo SQLite
  menuUrlBase: string | null;   // para mandar el enlace del menú
  esperaMs: number;             // cuánto se esperan los mensajes seguidos
  avisosCadaMs: number;
};

const MODELOS_POR_DEFECTO = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nex-agi/nex-n2.5-pro:free",
  "nvidia/nemotron-3.5-lightning:free",
];

export function leerConfiguracion(env: NodeJS.ProcessEnv = process.env): Configuracion {
  const falta: string[] = [];
  const req = (k: string) => {
    const v = env[k]?.trim();
    if (!v) falta.push(k);
    return v ?? "";
  };
  const c: Configuracion = {
    puerto: Number(env.PUERTO ?? 3000),
    secretoWebhook: req("AGENTE_WEBHOOK_SECRET"),
    secretoInterno: env.AGENTE_INTERNO_SECRET?.trim() || null,
    supabaseUrl: req("SUPABASE_URL"),
    supabaseClave: req("SUPABASE_SERVICE_KEY"),
    evolutionUrl: req("EVOLUTION_API_URL"),
    evolutionClave: req("EVOLUTION_API_KEY"),
    openrouterClave: req("OPENROUTER_API_KEY"),
    modelos: (env.OPENROUTER_MODELOS?.split(",").map((m) => m.trim()).filter(Boolean)) || MODELOS_POR_DEFECTO,
    whisperUrl: env.WHISPER_URL?.trim() || null,
    bd: env.AGENTE_BD?.trim() || "datos/agente.db",
    menuUrlBase: env.MENU_URL?.trim() || null,
    esperaMs: Number(env.AGENTE_ESPERA_MS ?? 4000),
    avisosCadaMs: Number(env.AGENTE_AVISOS_MS ?? 10000),
  };
  if (!c.modelos.length) c.modelos = MODELOS_POR_DEFECTO;
  if (falta.length) throw new Error(`Faltan variables de entorno: ${falta.join(", ")}`);
  if (c.secretoWebhook.length < 24) throw new Error("AGENTE_WEBHOOK_SECRET debe tener al menos 24 caracteres (openssl rand -hex 32)");
  if (!/^https:\/\//.test(c.supabaseUrl)) throw new Error("SUPABASE_URL debe empezar por https://");
  return c;
}
