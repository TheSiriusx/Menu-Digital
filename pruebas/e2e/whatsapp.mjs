import puppeteer from "puppeteer-core";
import { execFileSync } from "node:child_process";
import { codigoFresco, leerEnv, marcarUsado, pasoCodigo } from "./comun.mjs";
import { iniciarSimulada, CLAVE_SIMULADA } from "../../scripts/evolution-simulada.mjs";

const BASE = "http://localhost:3100";
const SIM = "http://127.0.0.1:4010";
const S = decodeURIComponent(new URL("..", import.meta.url).pathname);
const env = leerEnv(S + "e2e4.env");
marcarUsado(env.SA_TOTP_USADO);
const sql = (q) => JSON.parse(execFileSync("python3", ["-c", "import sys,json;sys.path.insert(0,sys.argv[1]);from db import sql;print(json.dumps(sql(sys.argv[2])))", S, q]).toString());
const res = [];
const ok = (c, m) => { res.push(!!c); console.log((c ? "OK    " : "FALLA ") + m); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms * 3)); // la red hacia Supabase va lenta desde aquí
const sim = (ruta, cuerpo) => fetch(SIM + ruta, { method: "POST", body: JSON.stringify(cuerpo ?? {}) }).then((r) => r.json());
const registro = () => fetch(SIM + "/__registro").then((r) => r.json());

let simulada = await iniciarSimulada(4010);
const browser = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:9222/session", protocol: "webDriverBiDi", defaultViewport: { width: 1000, height: 900 } });
const violaciones = [];
async function sesion() {
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  await page.evaluateOnNewDocument(() => { window.__csp = []; document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI)); });
  const ir = (r) => page.goto(BASE + r, { waitUntil: "networkidle0" });
  const ruta = () => new URL(page.url()).pathname;
  const poner = (sel, v) => page.$eval(sel, (el, x) => { el.value = x; }, v);
  const clic = (raiz, t) => page.evaluate((r, tx) => { const b = [...document.querySelector(r).querySelectorAll("button")].find((x) => x.textContent.trim() === tx); if (!b) throw new Error(`sin botón "${tx}" en ${r}`); b.click(); }, raiz, t);
  const abrir = (raiz, resumen) => page.evaluate((r, t) => { const s = [...document.querySelector(r).querySelectorAll("summary")].find((x) => x.textContent.includes(t)); if (!s) throw new Error("sin resumen " + t); if (!s.parentElement.open) s.click(); }, raiz, resumen);
  const mensaje = async (raiz, tipo, ms = 15000) => { await page.waitForFunction((r, t) => !!document.querySelector(`${r} [role=${t}]`), { timeout: ms }, raiz, tipo).catch(() => {}); return page.evaluate((r, t) => document.querySelector(`${r} [role=${t}]`)?.textContent ?? null, raiz, tipo); };
  const login = async (c, k, secreto) => { await ir("/login"); await poner("input[name=correo]", c); await poner("input[name=clave]", k); await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Entrar").click()); await page.waitForFunction(() => location.pathname !== "/login", { timeout: 10000 }).catch(() => {}); await page.waitForNetworkIdle?.({ idleTime: 600, timeout: 8000 }).catch(() => {}); await pasoCodigo(page, secreto); };
  const csp = async () => { violaciones.push(...(await page.evaluate(() => window.__csp))); };
  const estadoWA = () => page.evaluate(() => document.querySelector("[data-estado-whatsapp]")?.getAttribute("data-estado-whatsapp") ?? null);
  const esperarEstadoWA = (est, ms = 20000) => page.waitForFunction((e) => document.querySelector("[data-estado-whatsapp]")?.getAttribute("data-estado-whatsapp") === e, { timeout: ms }, est).then(() => true).catch(() => false);
  return { contexto, page, ir, ruta, poner, clic, abrir, mensaje, login, csp, estadoWA, esperarEstadoWA };
}

sql("update public.negocios set evolution_instance_name = null");
sql("delete from public.negocios where slug in ('local-wa-prueba','local-falla','adoptada','e2e-sin-wa')");

// ======================================================================= SUPER ADMIN: ALTA CON INSTANCIA
console.log("--- ALTA DE LOCALES: SE CREA LA INSTANCIA DE WHATSAPP ---");
const A = await sesion();
await A.login(env.SA_CORREO, env.SA_CLAVE, env.SA_TOTP);
const alta = async (nombre) => {
  await A.ir("/superadmin");
  await A.abrir("section[aria-labelledby=nuevo]", "Nuevo local");
  await A.poner("section[aria-labelledby=nuevo] input[name=nombre]", nombre);
  await A.clic("section[aria-labelledby=nuevo]", "Crear local");
  return A.mensaje("section[aria-labelledby=nuevo]", "status", 20000).then(async (m) => m ?? (await A.mensaje("section[aria-labelledby=nuevo]", "alert", 3000)));
};
let m = await alta("Local WA Prueba");
ok(m && m.includes("Local creado") && m.includes("Cuenta de WhatsApp creada"), `alta con Evolution disponible: "${m}"`);
let reg = await registro();
const crea = reg.find((x) => x.ruta === "/instance/create");
ok(crea && crea.cuerpo.instanceName === "menu-local-wa-prueba", "se pidió a Evolution la instancia «menu-local-wa-prueba»");
ok(crea?.apikey === CLAVE_SIMULADA, "con la clave del servidor");
ok(crea?.cuerpo.webhook?.url === "https://n8n.ejemplo.com/webhook/pedidos" && crea.cuerpo.webhook.headers["x-webhook-secret"] === "secreto-webhook", "y con el webhook hacia n8n");
ok(sql("select evolution_instance_name n from public.negocios where slug='local-wa-prueba'")[0].n === "menu-local-wa-prueba", "la instancia quedó guardada en el local");
await A.ir("/superadmin");
ok(await A.page.$eval('li[data-local="local-wa-prueba"]', (l) => l.textContent.includes("✓ menu-local-wa-prueba")), "la lista muestra «WhatsApp: ✓ menu-local-wa-prueba»");

await sim("/__modo", { modo: "error500" });
m = await alta("Local Falla");
ok(m && m.includes("Local creado") && m.includes("WhatsApp pendiente"), `Evolution caída: el local se crea igual y queda «pendiente»: "${(m || "").slice(0, 110)}…"`);
ok(m && !/boom|secretos|clave-de-prueba/.test(m), "el mensaje NO filtra detalles internos ni la clave");
ok(sql("select count(*) c from public.negocios where slug='local-falla'")[0].c === 1, "el local existe aunque WhatsApp falló");
await A.ir("/superadmin");
const LF = 'li[data-local="local-falla"]';
ok((await A.page.$eval(`${LF} [data-whatsapp]`, (e) => e.getAttribute("data-whatsapp"))) === "pendiente", "la lista lo marca «pendiente»");
await sim("/__modo", { modo: "ok" });
await A.abrir(LF, "Estado, plan y dueño");
await A.clic(LF, "Crear cuenta de WhatsApp");
await A.page.waitForFunction((sel) => document.querySelector(sel + " [data-whatsapp]")?.getAttribute("data-whatsapp") === "listo", { timeout: 40000 }, LF).catch(() => {});
ok(sql("select evolution_instance_name n from public.negocios where slug='local-falla'")[0].n === "menu-local-falla", "reintentar con Evolution recuperada funciona: la instancia queda creada y guardada");
await A.ir("/superadmin");
ok((await A.page.$eval(`${LF} [data-whatsapp]`, (e) => e.getAttribute("data-whatsapp"))) === "listo", "y ahora figura como listo");

await sim("/__precrear/menu-adoptada");
m = await alta("Adoptada");
ok(m && m.includes("ya existía"), `una instancia que ya existía en Evolution se adopta: "${(m || "").slice(0, 90)}"`);
ok((await registro()).filter((x) => x.ruta === "/instance/create" && x.cuerpo?.instanceName === "menu-adoptada").length === 0, "sin crear una segunda");

await A.ir("/superadmin");
const NV = 'li[data-local="nueva-victoria"]';
ok((await A.page.$eval(`${NV} [data-whatsapp]`, (e) => e.getAttribute("data-whatsapp"))) === "pendiente", "Nueva Victoria (sin instancia) figura «pendiente»");
await A.abrir(NV, "Estado, plan y dueño");
await A.clic(NV, "Crear cuenta de WhatsApp");
await A.page.waitForFunction((sel) => document.querySelector(sel + " [data-whatsapp]")?.getAttribute("data-whatsapp") === "listo", { timeout: 40000 }, NV).catch(() => {});
ok(sql("select evolution_instance_name n from public.negocios where slug='nueva-victoria'")[0].n === "menu-nueva-victoria", "se le crea la suya desde la lista");
ok(sql("select evolution_instance_name n from public.negocios where slug='nueva-victoria'")[0].n === "menu-nueva-victoria", "queda como menu-nueva-victoria");
await A.csp();

// ======================================================================= EL DUEÑO VINCULA SU WHATSAPP
console.log("--- EL DUEÑO VINCULA SU WHATSAPP (sin ayuda de nadie) ---");
await sim("/__desvincular/menu-nueva-victoria");
const O = await sesion();
await O.login(env.OWN_CORREO, env.OWN_CLAVE);
await O.ir("/admin/ajustes");
ok(await O.page.$("section[aria-labelledby=whatsapp]") !== null, "la pantalla de Ajustes tiene la sección «WhatsApp de pedidos»");
ok(await O.esperarEstadoWA("desconectado", 25000), "muestra el estado «Desconectado»");
const W = "section[aria-labelledby=whatsapp]";
ok((await O.page.$eval(W, (s) => [...s.querySelectorAll("button")].map((b) => b.textContent.trim()))).includes("Reescanear WhatsApp"), "ofrece «Reescanear WhatsApp»");
await O.clic(W, "Reescanear WhatsApp");
await O.page.waitForSelector(`${W} img[alt^="Código QR"]`, { timeout: 20000 }).catch(() => {});
const qr1 = await O.page.$eval(`${W} img[alt^="Código QR"]`, (i) => ({ src: i.src, ancho: i.naturalWidth })).catch(() => null);
ok(qr1 && qr1.src.startsWith("data:image/png;base64,") && qr1.ancho > 0, "aparece el QR (imagen PNG que se ve)");
ok((await O.page.content()).includes("Dispositivos vinculados"), "con las instrucciones de qué hacer en el teléfono");
const conectando = await O.esperarEstadoWA("conectando", 12000);
ok(conectando, "mientras se escanea, el estado pasa a «Conectando…»");
await O.page.waitForFunction((s) => document.querySelector('section[aria-labelledby=whatsapp] img[alt^="Código QR"]')?.src !== s, { timeout: 40000 }, qr1?.src).catch(() => {});
const qr2 = await O.page.$eval(`${W} img[alt^="Código QR"]`, (i) => i.src).catch(() => null);
ok(qr2 && qr2 !== qr1?.src, "el QR se renueva solo (sin recargar la página)");
await sim("/__escanear/menu-nueva-victoria");
ok(await O.esperarEstadoWA("conectado", 15000), "al escanear en el teléfono, la pantalla pasa a «Conectado» sola");
ok(!(await O.page.$(`${W} img[alt^="Código QR"]`)) && (await O.page.content()).includes("ya puede recibir y atender pedidos"), "el QR desaparece y avisa que el asistente ya atiende");
await sim("/__desvincular/menu-nueva-victoria");
ok(await O.esperarEstadoWA("desconectado", 20000), "si el WhatsApp se desvincula, la pantalla lo detecta sola");
ok((await O.page.$eval(W, (s) => [...s.querySelectorAll("button")].map((b) => b.textContent.trim()))).includes("Reescanear WhatsApp"), "y vuelve a ofrecer «Reescanear» (sin que tú intervengas)");
sql("update public.negocios set activo = false where slug = 'nueva-victoria'");
await O.ir("/admin/ajustes");
ok(await O.esperarEstadoWA("desconectado", 25000) && (await O.page.$eval(W, (s) => [...s.querySelectorAll("button")].every((b) => !b.matches(":disabled")))), "con el local PAUSADO por impago se puede reescanear igual (no se bloquea)");
sql("update public.negocios set activo = true where slug = 'nueva-victoria'");
await sim("/__modo", { modo: "error500" });
await O.ir("/admin/ajustes");
await O.page.waitForFunction(() => !!document.querySelector('section[aria-labelledby=whatsapp] [role=alert]'), { timeout: 20000 }).catch(() => {});
const alerta = await O.page.evaluate(() => document.querySelector('section[aria-labelledby=whatsapp] [role=alert]')?.textContent ?? null);
ok(alerta && !/boom|secretos|clave-de-prueba|500/.test(alerta), `Evolution con error: mensaje claro sin detalles internos: "${alerta}"`);
await sim("/__modo", { modo: "ok" });
await O.csp();

console.log("--- SUPER ADMIN VE Y REESCANEA POR UN LOCAL ---");
await A.ir("/superadmin/locales/nueva-victoria/ajustes");
await A.page.bringToFront(); // una pestaña en segundo plano no consulta el estado (a propósito)
const veDesconectado = await A.esperarEstadoWA("desconectado", 25000);
ok(veDesconectado, "en el panel del super admin se ve el estado de ese local" + (veDesconectado ? "" : ` [URL ${A.page.url()} · estado ${await A.page.evaluate(() => document.querySelector("[data-estado-whatsapp]")?.getAttribute("data-estado-whatsapp") ?? "sin componente")}]`));
await A.csp();

// ======================================================================= LOCAL SIN INSTANCIA
console.log("--- LOCAL SIN CUENTA DE WHATSAPP ---");
sql("insert into public.negocios (slug, nombre) values ('e2e-sin-wa', 'Sin WA')");
sql(`insert into public.perfiles (id, negocio_id, rol) select u.id, n.id, 'dueno' from auth.users u, public.negocios n where u.email = '${env.OWN2_CORREO}' and n.slug = 'e2e-sin-wa'`);
const O2 = await sesion();
await O2.login(env.OWN2_CORREO, env.OWN2_CLAVE);
await O2.ir("/admin/ajustes");
ok(await O2.esperarEstadoWA("sin_instancia", 20000), "un local sin instancia muestra «Sin cuenta de WhatsApp» (no rompe)");
ok((await O2.page.content()).includes("Escríbele a Starck Labs"), "y le dice qué hacer");
ok(!(await O2.page.$eval("section[aria-labelledby=whatsapp]", (s) => s.querySelector("img[alt^='Código QR']") !== null)), "sin ofrecer un QR que no existe");

// ======================================================================= CICLO COMPLETO: MENÚ -> WHATSAPP -> AGENTE
console.log("--- CICLO COMPLETO: MENÚ -> MENSAJE -> LECTURA -> crear_pedido ---");
sql("update public.productos set stock = 10, disponible = true where negocio_id = (select id from public.negocios where slug='nueva-victoria') and nombre = 'Pan canilla'");
sql("update public.productos set stock = null, disponible = true where negocio_id = (select id from public.negocios where slug='nueva-victoria') and nombre = 'Pan sobado'");
sql("update public.negocios set telefono_whatsapp = '584120000000' where slug = 'nueva-victoria'");
await dormir(62000); // la caché pública del menú dura hasta 60 s
const P = await sesion();
await P.page.evaluateOnNewDocument(() => { window.open = (u) => { window.__wa = u; return { opener: null }; }; });
await P.ir("/nueva-victoria");
await P.page.evaluate(() => {
  document.querySelector('button[aria-label="Agregar Pan canilla"]').click();
});
await dormir(300);
await P.page.evaluate(() => document.querySelector('button[aria-label="Agregar uno de Pan canilla"]').click());
await P.page.evaluate(() => document.querySelector('button[aria-label="Agregar Pan sobado"]').click());
await dormir(300);
await P.page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Ver pedido")).click());
await P.page.$eval("dialog input[autocomplete=name]", (i) => { i.value = "María Prueba"; });
await P.page.$eval("dialog textarea", (t) => { t.value = "Sin azúcar, por favor"; });
await P.page.evaluate(() => document.querySelector("dialog form").requestSubmit());
const url = await P.page.evaluate(() => window.__wa);
const mensajeWA = url ? decodeURIComponent(url.split("text=")[1]) : "";
console.log(mensajeWA.split("\n").map((l) => "   | " + l).join("\n"));
const bloque = mensajeWA.split("\n").at(-1);
const cod = sql("select left(id::text,8) c, nombre from public.productos where negocio_id=(select id from public.negocios where slug='nueva-victoria') and nombre in ('Pan canilla','Pan sobado') order by nombre");
const codCanilla = cod.find((x) => x.nombre === "Pan canilla").c, codSobado = cod.find((x) => x.nombre === "Pan sobado").c;
ok(bloque.startsWith("[[PEDIDO v1|negocio=nueva-victoria|items="), "el mensaje real del navegador termina con el bloque estructurado");
ok(bloque.includes(`${codCanilla}x2`) && bloque.includes(`${codSobado}x1`), "con los códigos REALES de la base de datos y las cantidades elegidas");
ok(bloque.includes("total=1.30"), "y el total (1.30 = 2 x 0.50 + 0.30)");

// El agente: lee el bloque y crea el pedido (aquí se simula con la función SQL real, como haría n8n con service_role).
const pedido = /items=([^|]+)\|total=([\d.]+)/.exec(bloque);
const items = pedido[1].split(",").map((p) => { const [c, q] = p.split("x"); return { codigo: c, cantidad: Number(q) }; });
const r = sql(`select public.crear_pedido('menu-nueva-victoria', 'nueva-victoria', '584129990001', 'María Prueba', '${JSON.stringify(items)}'::jsonb, null, 'retiro', null, 'Sin azúcar, por favor', 'wamid-e2e-1') as r`)[0].r;
ok(r.ok === true && Number(r.total_usd) === Number(pedido[2]), `crear_pedido con lo leído del mensaje: ok, total ${r.total_usd} = total del mensaje ${pedido[2]}`);
ok(sql("select stock s from public.productos where negocio_id=(select id from public.negocios where slug='nueva-victoria') and nombre='Pan canilla'")[0].s === 8, "el stock de la canilla bajó de 10 a 8");
ok(sql("select count(*) c from public.pedido_items where pedido_id = '" + r.pedido_id + "'")[0].c === 2, "el pedido quedó con sus 2 líneas");
ok(sql("select nombre n from public.clientes where telefono = '584129990001'")[0].n === "María Prueba", "y el cliente quedó registrado");
const r2 = sql(`select public.crear_pedido('menu-nueva-victoria', 'nueva-victoria', '584129990001', 'María Prueba', '${JSON.stringify(items)}'::jsonb, null, 'retiro', null, null, 'wamid-e2e-1') as r`)[0].r;
ok(r2.duplicado === true && sql("select stock s from public.productos where negocio_id=(select id from public.negocios where slug='nueva-victoria') and nombre='Pan canilla'")[0].s === 8, "si el webhook se repite: mismo pedido y el stock NO se vuelve a descontar");

ok(violaciones.length === 0, `sin violaciones de la CSP en todo el recorrido (${violaciones.length}${violaciones.length ? ": " + violaciones.slice(0, 3).join(" | ") : ""})`);
for (const s of [A, O, O2, P]) await s.contexto.close().catch(() => {});
await browser.disconnect(); await simulada.cerrar();
sql("delete from public.negocios where slug in ('local-wa-prueba','local-falla','adoptada','e2e-sin-wa')");
console.log(`\n${res.filter(Boolean).length}/${res.length} pruebas correctas`);
process.exit(res.every(Boolean) ? 0 : 1);
