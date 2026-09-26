// Conversación con el modelo (OpenRouter, API compatible con OpenAI) usando herramientas.
// Los modelos gratuitos se caen o responden vacío en horas pico: se reintenta y se pasa al siguiente de la lista.

export type MensajeIA =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: LlamadaIA[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type LlamadaIA = { id: string; type: "function"; function: { name: string; arguments: string } };

export type Herramienta = {
  nombre: string;
  descripcion: string;
  parametros: Record<string, unknown>; // JSON Schema
  ejecutar: (args: Record<string, unknown>) => Promise<string>;
};

export type RespuestaModelo = { contenido: string | null; llamadas: LlamadaIA[] };

export interface Modelo {
  completar(mensajes: MensajeIA[], herramientas: Herramienta[]): Promise<RespuestaModelo>;
}

export class ErrorIA extends Error {}

type Fetch = typeof fetch;

export class OpenRouter implements Modelo {
  private clave: string;
  private modelos: string[];
  private f: Fetch;
  private esperar: (ms: number) => Promise<void>;
  constructor(clave: string, modelos: string[], f: Fetch = fetch, esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))) {
    this.clave = clave;
    this.modelos = modelos;
    this.f = f;
    this.esperar = esperar;
  }

  async completar(mensajes: MensajeIA[], herramientas: Herramienta[]): Promise<RespuestaModelo> {
    const tools = herramientas.map((h) => ({ type: "function", function: { name: h.nombre, description: h.descripcion, parameters: h.parametros } }));
    for (const modelo of this.modelos) {
      for (let intento = 0; intento < 2; intento++) {
        let r: Response;
        try {
          r = await this.f("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.clave}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://starcklabs.com",
              "X-Title": "Asistente de panaderias",
            },
            body: JSON.stringify({ model: modelo, messages: mensajes, tools, tool_choice: "auto", temperature: 0.3, max_tokens: 600 }),
            redirect: "error",
            signal: AbortSignal.timeout(45000),
          });
        } catch {
          await this.esperar(1500);
          continue;
        }
        if (r.status === 429 || r.status >= 500) {
          await this.esperar(2000 * (intento + 1));
          continue;
        }
        if (!r.ok) break; // 400/404 (p. ej. el modelo no admite herramientas): se prueba el siguiente
        const d = (await r.json().catch(() => null)) as {
          choices?: { message?: { content?: string | null; tool_calls?: LlamadaIA[] } }[];
          error?: unknown;
        } | null;
        const m = d?.choices?.[0]?.message;
        const llamadas = (m?.tool_calls ?? []).filter((c) => c?.function?.name);
        const contenido = typeof m?.content === "string" ? m.content.trim() : "";
        if (llamadas.length || contenido) return { contenido: contenido || null, llamadas };
        await this.esperar(1000); // respuesta vacía: reintento
      }
    }
    throw new ErrorIA("ningún modelo respondió");
  }
}

// Bucle de herramientas: el modelo pide herramientas, se ejecutan y se le devuelven los resultados,
// hasta que responde con texto (o se agotan las vueltas). `alto()` corta cuando una herramienta ya
// dejó la respuesta decidida (p. ej. el resumen de un pedido).
export async function conversar(
  modelo: Modelo,
  mensajes: MensajeIA[],
  herramientas: Herramienta[],
  alto: () => boolean = () => false,
  maxVueltas = 5,
): Promise<string | null> {
  const porNombre = new Map(herramientas.map((h) => [h.nombre, h]));
  const hilo = [...mensajes];
  for (let vuelta = 0; vuelta < maxVueltas; vuelta++) {
    const r = await modelo.completar(hilo, herramientas);
    if (!r.llamadas.length) return r.contenido;
    hilo.push({ role: "assistant", content: r.contenido, tool_calls: r.llamadas });
    for (const c of r.llamadas.slice(0, 4)) {
      const h = porNombre.get(c.function.name);
      let resultado: string;
      if (!h) {
        resultado = `Error: la herramienta ${c.function.name} no existe.`;
      } else {
        let args: Record<string, unknown> = {};
        try {
          const leido = JSON.parse(c.function.arguments || "{}");
          if (leido && typeof leido === "object" && !Array.isArray(leido)) args = leido;
        } catch {
          resultado = "Error: argumentos no válidos (JSON).";
        }
        try {
          resultado ??= await h.ejecutar(args);
        } catch {
          resultado = "Error: la herramienta falló. Dile al cliente que una persona del equipo le ayuda.";
        }
      }
      hilo.push({ role: "tool", tool_call_id: c.id, content: resultado.slice(0, 4000) });
    }
    if (alto()) return null;
  }
  return null;
}
