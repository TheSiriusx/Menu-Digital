import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { Almacen } from "../src/almacen.ts";
import { procesarAvisos } from "../src/avisos.ts";
import type { AvisoPendiente } from "../src/clientes.ts";
import { Evolution, Supabase } from "../src/clientes.ts";
import { leerConfiguracion } from "../src/config.ts";
import { partir } from "../src/envio.ts";
import { conversar, OpenRouter, type Herramienta } from "../src/ia.ts";
import { resolverProducto } from "../src/menu.ts";
import { normalizar } from "../src/normalizar.ts";
import { crearServidor } from "../src/servidor.ts";
import { CLIENTE, config, MENU, montar, PROPIO } from "./ayudas.ts";

// ------------------------------------------------------------------ avisos automáticos
const aviso = (clave: string, pedido: Partial<AvisoPendiente["pedido"]> = {}, cfg = {}): AvisoPendiente => ({
  id: Math.floor(Math.random() * 1e6),
  clave,
  instancia: "menu-nueva-victoria",
  negocio: { nombre: "Panadería Nueva Victoria", slug: "nueva-victoria", activo: true, tasa_bs: 60, telefono: PROPIO },
  config: config(cfg) as unknown as Record<string, unknown>,
  pedido: { codigo: "c0ffee01", estado: "nuevo", total_usd: 3.5, entrega: "retiro", direccion: null, telefono: CLIENTE, nombre: "Ana Pérez", creado: "2026-09-28T13:45:00Z", items: [], ...pedido },
});

test("avisos de estado al cliente", async () => {
  const m = montar();
  m.supabase.avisos = [
    aviso("estado:listo", { estado: "listo" }),
    aviso("estado:listo", { estado: "listo", entrega: "domicilio" }),
    aviso("estado:pagado", { estado: "pagado" }),
    aviso("estado:cancelado", { estado: "cancelado" }),
  ];
  assert.equal(await procesarAvisos(m.deps), 4);
  const t = m.evolution.a(CLIENTE);
  assert.match(t, /¡Hola, Ana! Tu pedido #C0FFEE01 ya está listo para retirar 🥖/);
  assert.match(t, /Tu pedido #C0FFEE01 va en camino 🛵/);
  assert.match(t, /Recibimos tu pago del pedido #C0FFEE01/);
  assert.match(t, /fue cancelado/);
  assert.ok(m.supabase.resultados.every((r) => r.ok));
});

test("confirmado con «datos de pago al confirmar»: en Bs a la tasa de HOY", async () => {
  const m = montar();
  m.supabase.avisos = [aviso("estado:confirmado", { estado: "confirmado" }, { pago_momento: "al_confirmar" })];
  await procesarAvisos(m.deps);
  const t = m.evolution.a(CLIENTE);
  assert.match(t, /Confirmamos tu pedido #C0FFEE01/);
  assert.match(t, /Total: \$3,50 \(Bs 210,00\)/, "tasa de hoy (60), no la del pedido");
  assert.match(t, /Pago móvil: Banco X/);
});

test("reseña: con enlace y asistente encendido; sin enlace o apagado no se pide", async () => {
  const m = montar();
  m.supabase.avisos = [aviso("resena", { estado: "entregado" })];
  await procesarAvisos(m.deps);
  assert.match(m.evolution.a(CLIENTE), /nos ayudaría muchísimo tu reseña: https:\/\/g.page\/r\/prueba/);

  const m2 = montar();
  m2.supabase.avisos = [aviso("resena", {}, { resena_url: null }), aviso("resena", {}, { agente_activo: false })];
  await procesarAvisos(m2.deps);
  assert.equal(m2.evolution.enviados.length, 0);
  assert.ok(m2.supabase.resultados.every((r) => r.ok), "se dan por atendidos (no se reintentan)");
});

test("recordatorio al dueño solo si el pedido sigue «nuevo»", async () => {
  const m = montar();
  m.supabase.avisos = [aviso("recordatorio:1"), aviso("recordatorio:2", { estado: "confirmado" })];
  await procesarAvisos(m.deps);
  assert.equal(m.evolution.enviados.length, 1);
  assert.match(m.evolution.a(PROPIO), /⏰ El pedido #C0FFEE01 de Ana Pérez sigue sin atender \(hace 15 min\)/);
});

test("aviso que no se puede enviar: queda para reintentar", async () => {
  const m = montar();
  m.supabase.avisos = [{ ...aviso("estado:listo"), instancia: null }];
  await procesarAvisos(m.deps);
  assert.equal(m.supabase.resultados[0].ok, false);
  assert.match(m.supabase.resultados[0].error ?? "", /no tiene WhatsApp vinculado/);
});

// ------------------------------------------------------------------ servidor
test("webhook: exige el secreto; responde enseguida", async () => {
  const recibidos: unknown[] = [];
  const s = crearServidor({
    secretoWebhook: "s".repeat(32), secretoInterno: "i".repeat(32), log: () => {},
    webhook: async (c) => void recibidos.push(c), avisos: async () => 3,
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  const post = (ruta: string, cab: Record<string, string> = {}, cuerpo = "{}") => fetch(base + ruta, { method: "POST", headers: cab, body: cuerpo });
  try {
    assert.equal((await fetch(`${base}/salud`)).status, 200);
    assert.equal((await post("/webhook")).status, 401, "sin secreto");
    assert.equal((await post("/webhook", { "x-webhook-secret": "x".repeat(32) })).status, 401, "secreto equivocado");
    assert.equal((await post("/webhook", { "x-webhook-secret": "s".repeat(32) }, '{"a":1}')).status, 200);
    assert.equal((await post(`/webhook?secreto=${"s".repeat(32)}`, {}, '{"b":2}')).status, 200, "también por parámetro (Evolution sin cabeceras)");
    assert.equal((await post("/webhook", { "x-webhook-secret": "s".repeat(32) }, "no es json")).status, 400);
    assert.equal((await post("/interno/avisos", { "x-webhook-secret": "s".repeat(32) })).status, 401, "el secreto del webhook no abre lo interno");
    const r = await post("/interno/avisos", { "x-webhook-secret": "i".repeat(32) });
    assert.deepEqual(await r.json(), { ok: true, enviados: 3 });
    assert.equal((await fetch(`${base}/otra`)).status, 404);
    assert.deepEqual(recibidos, [{ a: 1 }, { b: 2 }]);
  } finally {
    s.close();
  }
});

test("configuración: falta algo o el secreto es débil -> no arranca", () => {
  const base = {
    AGENTE_WEBHOOK_SECRET: "a".repeat(40), SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "k",
    EVOLUTION_API_URL: "http://evolution:8080", EVOLUTION_API_KEY: "e", OPENROUTER_API_KEY: "o",
  };
  assert.equal(leerConfiguracion(base).modelos.length, 3);
  assert.throws(() => leerConfiguracion({ ...base, SUPABASE_SERVICE_KEY: "" }), /SUPABASE_SERVICE_KEY/);
  assert.throws(() => leerConfiguracion({ ...base, AGENTE_WEBHOOK_SECRET: "corto" }), /24 caracteres/);
  assert.throws(() => leerConfiguracion({ ...base, SUPABASE_URL: "http://x.supabase.co" }), /https/);
  assert.deepEqual(leerConfiguracion({ ...base, OPENROUTER_MODELOS: "a:free, b:free" }).modelos, ["a:free", "b:free"]);
});

// ------------------------------------------------------------------ Evolution: formas del webhook
test("normalizar: texto, LID, grupos, eventos ajenos y el panel del dueño", () => {
  const base = (key: Record<string, unknown>, message: Record<string, unknown>, extra = {}) => ({
    event: "messages.upsert", instance: "menu-x", sender: "584120000000@s.whatsapp.net", data: { key, pushName: "Ana", message }, ...extra,
  });
  const t = normalizar(base({ remoteJid: "999000000001@s.whatsapp.net", fromMe: false, id: "A" }, { conversation: "hola" }))!;
  assert.equal(t.telefono, "999000000001");
  assert.equal(t.texto, "hola");
  assert.equal(t.esPanel, false);
  const l = normalizar(base({ remoteJid: "18928@lid", remoteJidAlt: "999000000002@s.whatsapp.net", id: "B" }, { extendedTextMessage: { text: "hey" } }))!;
  assert.deepEqual([l.telefono, l.lid, l.texto, l.jid], ["999000000002", "18928", "hey", "999000000002@s.whatsapp.net"]);
  const solo = normalizar(base({ remoteJid: "18928@lid", id: "C" }, { conversation: "x" }))!;
  assert.deepEqual([solo.telefono, solo.lid, solo.jid], [null, "18928", "18928@lid"]);
  assert.equal(normalizar(base({ remoteJid: "123@g.us", id: "D" }, { conversation: "x" }))!.esGrupo, true);
  assert.equal(normalizar({ ...base({ remoteJid: "1@s.whatsapp.net", id: "E" }, {}), event: "connection.update" }), null);
  assert.equal(normalizar({ event: "MESSAGES_UPSERT", instance: "menu-x", data: { key: { remoteJid: "1@s.whatsapp.net", id: "F" }, message: { conversation: "y" } } })!.texto, "y");
  const panel = normalizar(base({ remoteJid: "584120000000@s.whatsapp.net", fromMe: true, id: "G" }, { conversation: "pedidos" }))!;
  assert.equal(panel.esPanel, true);
  const audio = normalizar(base({ remoteJid: "1@s.whatsapp.net", id: "H" }, { audioMessage: { mimetype: "audio/ogg" }, base64: "QUJD" }))!;
  assert.deepEqual([audio.tipo, audio.base64], ["audio", "QUJD"]);
  assert.equal(normalizar(null), null);
  assert.equal(normalizar({ event: "messages.upsert", data: {} }), null, "sin instancia ni id");
});

// ------------------------------------------------------------------ almacén
test("almacén: un cliente que primero llegó solo con LID se une al de su número", () => {
  const a = new Almacen();
  const soloLid = a.contacto("menu-x", null, "18928", "Ana", "18928@lid");
  a.guardarMensaje(soloLid.id, "cliente", "hola");
  const conNumero = a.contacto("menu-x", "999000000001", null, null, "999000000001@s.whatsapp.net");
  const ambos = a.contacto("menu-x", "999000000001", "18928", null, "999000000001@s.whatsapp.net");
  assert.equal(ambos.id, conNumero.id);
  assert.equal(ambos.lid, "18928");
  assert.equal(a.historial(ambos.id).length, 1, "la conversación anterior no se pierde");
  assert.equal(a.yaProcesado("M1"), false);
  assert.equal(a.yaProcesado("M1"), true);
});

// ------------------------------------------------------------------ búsqueda de productos
test("resolver productos por lo que escribe el cliente", () => {
  const nombre = (t: string) => {
    const r = resolverProducto(MENU, t);
    return r.ok ? r.producto.nombre : `${r.motivo}:${r.opciones.join("/")}`;
  };
  assert.equal(nombre("canillas"), "Pan canilla");
  assert.equal(nombre("Pan Sobado"), "Pan sobado");
  assert.equal(nombre("tequeños"), "Tequeños x10");
  assert.equal(nombre("torta"), "Torta de chocolate");
  assert.equal(nombre("aaaa0004"), "Torta de chocolate");
  assert.equal(nombre("pan"), "ambiguo:Pan canilla/Pan sobado");
  assert.equal(nombre("pizza"), "no_encontrado:");
});

test("partir la respuesta en mensajes cortos", () => {
  assert.deepEqual(partir("Hola"), ["Hola"]);
  const largo = partir(["A".repeat(200), "B".repeat(200), "C".repeat(200), "D".repeat(200), "E".repeat(50)].join("\n\n"));
  assert.ok(largo.length <= 3);
  assert.equal(largo.join("\n\n").replace(/\s/g, "").length, 850);
});

// ------------------------------------------------------------------ IA
test("OpenRouter: reintenta, cambia de modelo y no manda la clave a otro lado", async () => {
  const pedidos: { modelo: string; auth: string | null; redirect: string | undefined }[] = [];
  const respuestas = [
    new Response("", { status: 503 }),
    new Response("", { status: 503 }),
    new Response(JSON.stringify({ error: "no tools" }), { status: 404 }),
    new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }),
    new Response(JSON.stringify({ choices: [{ message: { content: "¡Hola!" } }] }), { status: 200 }),
  ];
  const f = (async (_u: string, init: RequestInit) => {
    const cuerpo = JSON.parse(String(init.body));
    pedidos.push({ modelo: cuerpo.model, auth: (init.headers as Record<string, string>).Authorization, redirect: init.redirect });
    return respuestas.shift()!;
  }) as unknown as typeof fetch;
  const ia = new OpenRouter("clave-secreta", ["m1:free", "m2:free", "m3:free"], f, async () => {});
  const r = await ia.completar([{ role: "user", content: "hola" }], []);
  assert.equal(r.contenido, "¡Hola!");
  assert.deepEqual(pedidos.map((p) => p.modelo), ["m1:free", "m1:free", "m2:free", "m3:free", "m3:free"]);
  assert.ok(pedidos.every((p) => p.redirect === "error" && p.auth === "Bearer clave-secreta"));
  const nada = new OpenRouter("k", ["m1"], (async () => new Response("", { status: 500 })) as unknown as typeof fetch, async () => {});
  await assert.rejects(nada.completar([], []), /ningún modelo/);
});

test("conversar: ejecuta herramientas, tolera argumentos rotos y herramientas inventadas", async () => {
  const usadas: unknown[] = [];
  const h: Herramienta = { nombre: "eco", descripcion: "", parametros: {}, ejecutar: async (a) => (usadas.push(a), "ok") };
  const guion = [
    { contenido: null, llamadas: [
      { id: "1", type: "function" as const, function: { name: "eco", arguments: '{"x":1}' } },
      { id: "2", type: "function" as const, function: { name: "eco", arguments: "{roto" } },
      { id: "3", type: "function" as const, function: { name: "borrar_todo", arguments: "{}" } },
    ] },
    { contenido: "listo", llamadas: [] },
  ];
  const vistos: unknown[] = [];
  const r = await conversar({ completar: async (m) => (vistos.push(m), guion.shift()!) }, [{ role: "user", content: "hola" }], [h]);
  assert.equal(r, "listo");
  assert.deepEqual(usadas, [{ x: 1 }]);
  const resultados = (vistos[1] as { role: string; content: string }[]).filter((x) => x.role === "tool").map((x) => x.content);
  assert.deepEqual(resultados, ["ok", "Error: argumentos no válidos (JSON).", "Error: la herramienta borrar_todo no existe."]);
});

// ------------------------------------------------------------------ clientes HTTP
test("clientes HTTP: sin redirecciones, con tiempo máximo y sin filtrar respuestas internas", async () => {
  const vistos: RequestInit[] = [];
  const f = (async (_u: string, init: RequestInit) => {
    vistos.push(init);
    return new Response("detalle interno secreto", { status: 500 });
  }) as unknown as typeof fetch;
  await assert.rejects(new Supabase("https://x.supabase.co", "clave", f).contexto("menu-x"), (e: Error) => /supabase: respondió 500/.test(e.message) && !/secreto|clave/.test(e.message));
  await assert.rejects(new Evolution("http://evolution:8080", "clave", f).enviarTexto("menu-x", "999000000001", "hola"), /evolution: respondió 500/);
  assert.ok(vistos.every((v) => v.redirect === "error" && v.signal instanceof AbortSignal));
});
