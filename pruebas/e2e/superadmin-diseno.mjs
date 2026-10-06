// Super admin rediseñado («Warm Culinary Modernism») y sus métricas reales: marco, cifras, buscador, filtro,
// vista, alta de local, Analíticas, reporte CSV, permisos y contador de visitas del menú. Saca capturas.
// Requiere: servidor en :3100, usuarios de preparar.py (e2e4.env) y Firefox (firefox.sh).
import puppeteer from "puppeteer-core";
import { execFileSync } from "node:child_process";
import { leerEnv, marcarUsado, pasoCodigo } from "./comun.mjs";

const BASE = "http://localhost:3100";
const S = decodeURIComponent(new URL("..", import.meta.url).pathname);
const env = leerEnv(S + "e2e4.env");
marcarUsado(env.SA_TOTP_USADO);
const SLUG = "masscafe-1507";
const sql = (q) => JSON.parse(execFileSync("python3", ["-c", "import sys,json;sys.path.insert(0,sys.argv[1]);from db import sql;print(json.dumps(sql(sys.argv[2])))", S, q]).toString());
const res = [];
const ok = (c, m) => { res.push(!!c); console.log((c ? "OK    " : "FALLA ") + m); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:9222/session", protocol: "webDriverBiDi", defaultViewport: { width: 1280, height: 900 } });
const errores = [];
async function sesion() {
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  await page.evaluateOnNewDocument(() => {
    const o = console.error.bind(console);
    console.error = (...a) => o(...a.map((x) => (x instanceof Error ? `${x.name}: ${x.message}` : x)));
  });
  // __cf_bm: cookie de Cloudflare de las imágenes de Supabase (ajena a la app).
  page.on("pageerror", (e) => !/__cf_bm/.test(String(e)) && errores.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/__cf_bm|Error in input stream/.test(m.text()) && errores.push(`[${page.url()}] ${m.text()}`));
  const ir = async (r) => { await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {}); return page.goto(BASE + r, { waitUntil: "networkidle0" }); };
  const login = async (correo, clave, secreto) => {
    await ir("/login");
    await page.$eval("input[name=correo]", (e, v) => (e.value = v), correo);
    await page.$eval("input[name=clave]", (e, v) => (e.value = v), clave);
    await page.evaluate(() => [...document.querySelectorAll("form button")].find((b) => b.textContent.trim() === "Entrar").click());
    await page.waitForFunction(() => location.pathname !== "/login", { timeout: 15000 }).catch(() => {});
    await page.waitForNetworkIdle?.({ idleTime: 500, timeout: 8000 }).catch(() => {});
    if (secreto) await pasoCodigo(page, secreto);
  };
  return { contexto, page, ir, login };
}
const foto = (page, nombre, completa = true) => page.screenshot({ path: `${S}shots/sa-${nombre}.png`, fullPage: completa });
const visible = (page, sel) => page.$eval(sel, (el) => { const r = el.getBoundingClientRect(); return !el.hidden && getComputedStyle(el).display !== "none" && r.width > 0 && r.height > 0; }).catch(() => false);

// ---------------------------------------------------------------- super admin en computadora
const A = await sesion();
await A.login(env.SA_CORREO, env.SA_CLAVE, env.SA_TOTP);
await A.ir("/superadmin");
const p = A.page;
ok(await p.$eval("aside nav[aria-label='Super admin']", (n) => [...n.querySelectorAll("a")].map((a) => a.textContent.replace(/\d+$/, "").trim()).join("|")).then((t) => t === "Locales|Analíticas|Mi cuenta|Seguridad").catch(() => false), "barra lateral: Locales, Analíticas, Mi cuenta y Seguridad (nada inventado)");
ok((await p.$$eval("aside a[aria-current=page]", (a) => a.map((x) => x.textContent))).some((t) => t.startsWith("Locales")), "Locales marcado como activo");
ok(await p.$eval("aside", (a) => a.textContent.includes("Pídelo by Starck Labs")), "pie «Pídelo by Starck Labs»");
ok((await p.$eval("header nav[aria-label=Ubicación]", (n) => n.textContent).catch(() => "")).includes("Locales"), "migas: Super admin › Locales");
const fuente = await p.$eval("h1", (h) => getComputedStyle(h).fontFamily);
ok(/jakarta/i.test(fuente), `títulos en Plus Jakarta Sans (${fuente.split(",")[0]})`);
ok(/inter/i.test(await p.$eval("main p", (e) => getComputedStyle(e).fontFamily)), "texto en Inter");
ok((await p.$$("section[aria-label='Resumen de locales'] > div")).length === 4, "4 cifras de resumen");
const LI = `li[data-local="${SLUG}"]`;
ok(!!(await p.$(LI)), "la tarjeta de Masscafe 1507 está");
ok((await p.$eval(`${LI} [data-estado]`, (e) => e.textContent)) === "Activo", "con su estado «Activo»");
const cifras = await p.$eval(LI, (li) => li.textContent);
ok(/Visitas hoy/.test(cifras) && /Pedidos WhatsApp hoy/.test(cifras) && /Respuesta \(7 días\)/.test(cifras), "franja de métricas: visitas, pedidos y respuesta");
await foto(p, "locales-pc");

// buscador, filtro y vista
const escribir = async (t) => { await p.$eval("input[type=search]", (el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); }, t); await dormir(200); };
await escribir("zzz-no-existe");
ok(!(await visible(p, LI)) && (await visible(p, "[data-sin-resultados]")), "buscar algo que no existe: oculta la tarjeta y avisa");
await escribir("MASSCAFE");
ok(await visible(p, LI), "buscar «MASSCAFE» (mayúsculas): aparece");
await escribir("cafeteria");
ok(await visible(p, LI), "buscar por el tipo sin tilde («cafeteria»): aparece");
await escribir("");
const filtrar = async (v) => { await p.$eval("main select:not([name])", (el, x) => { const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set; set.call(el, x); el.dispatchEvent(new Event("change", { bubbles: true })); }, v); await dormir(200); };
await filtrar("pausados");
ok(!(await visible(p, LI)), "filtro «Pausados»: Masscafe (activo) no sale");
await filtrar("activos");
ok(await visible(p, LI), "filtro «Activos»: sale");
await filtrar("todos");
await p.click("button[aria-label='Vista en lista']");
await dormir(200);
ok(await p.$eval(`${LI} > div[style]`, (d) => getComputedStyle(d).display === "none"), "vista en lista: sin la cabecera de color");
await foto(p, "locales-lista-pc");
await p.click("button[aria-label='Vista en tarjetas']");

// alta de local: el botón abre el panel
ok(!(await p.$eval("#panel-nuevo-local", (d) => d.open)), "el panel «Nuevo local» empieza cerrado");
await p.evaluate(() => [...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Nuevo local").click());
await dormir(400);
ok(await p.$eval("#panel-nuevo-local", (d) => d.open), "«Nuevo local» abre el formulario");
ok(!!(await p.$("section[aria-labelledby=nuevo] input[name=nombre]")), "con sus campos de siempre");
await foto(p, "nuevo-local-pc", false);

// Analíticas
await A.ir("/superadmin/analiticas");
ok((await p.$$("section[aria-label='Totales del periodo'] > div")).length === 5, "Analíticas: 5 cifras (visitas, pedidos, conversión, ventas, respuesta)");
ok(!!(await p.$(`tr[data-fila-local="${SLUG}"]`)), "tabla por local con Masscafe");
ok((await p.$$("section[aria-label='Por día'] figure")).length === 2, "gráficas de visitas y pedidos por día");
await A.ir("/superadmin/analiticas?dias=7");
ok((await p.$eval("a[aria-current=page][href*='dias=']", (a) => a.textContent)) === "7 días", "periodo de 7 días");
await foto(p, "analiticas-pc");

// Reporte CSV (con la sesión del super admin)
const csv = await p.evaluate(async () => {
  const r = await fetch("/superadmin/reporte?dias=30");
  return { estado: r.status, tipo: r.headers.get("content-type"), nombre: r.headers.get("content-disposition"), texto: await r.text() };
});
ok(csv.estado === 200 && /text\/csv/.test(csv.tipo), "reporte: descarga CSV");
ok(/pidelo-locales-\d{4}-\d{2}-\d{2}-30d\.csv/.test(csv.nombre ?? ""), `nombre del archivo (${csv.nombre})`);
ok(csv.texto.includes('"Masscafe 1507"') && csv.texto.includes("Visitas (30 días)"), "con los locales y sus métricas");

// Un local por dentro
await A.ir(`/superadmin/locales/${SLUG}`);
ok((await p.content()).includes("Administrando:") && !!(await p.$("nav[aria-label=Local]")), "página del local: cabecera y pestañas");
await foto(p, "local-pc", false);

// ---------------------------------------------------------------- celular
await p.setViewport({ width: 390, height: 844 });
await A.ir("/superadmin");
ok(!(await visible(p, "aside")), "celular: sin barra lateral");
ok(await visible(p, "nav[aria-label='Super admin (celular)']"), "celular: pestañas abajo");
ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: sin desplazamiento horizontal");
await foto(p, "locales-cel");
await A.ir("/superadmin/analiticas");
ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "celular: Analíticas sin desplazamiento horizontal");
await foto(p, "analiticas-cel");

// ---------------------------------------------------------------- permisos
const O = await sesion();
await O.login(env.OWN_CORREO, env.OWN_CLAVE);
const ajeno = await O.page.evaluate(async () => {
  const r = await fetch("/superadmin/reporte?dias=30");
  return { url: r.url, csv: (r.headers.get("content-type") ?? "").includes("csv") };
});
ok(!ajeno.csv && !ajeno.url.includes("/superadmin/reporte"), `un dueño no puede bajar el reporte (termina en ${new URL(ajeno.url).pathname})`);
const anonimo = await fetch(BASE + "/superadmin/reporte", { redirect: "manual" });
ok(anonimo.status >= 300 && anonimo.status < 400 && !(anonimo.headers.get("content-type") ?? "").includes("csv"), "sin sesión: redirige, no hay CSV");

// ---------------------------------------------------------------- contador de visitas del menú
const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
const visitas = () => Number(sql(`select coalesce(sum(v.visitas), 0) n from public.visitas_menu v join public.negocios n on n.id = v.negocio_id where n.slug = '${SLUG}' and v.dia = '${hoy}'`)[0].n);
const antes = visitas();
const C = await sesion();
await C.ir(`/${SLUG}`);
await dormir(2500);
const despues = visitas();
ok(despues === antes + 1, `abrir el menú suma 1 visita (${antes} → ${despues})`);
await C.ir(`/${SLUG}`);
await dormir(2500);
ok(visitas() === despues, "volver a abrirlo el mismo día en el mismo navegador no suma");
const bot = await fetch(`${BASE}/${SLUG}`, { headers: { "User-Agent": "WhatsApp/2.23 (vista previa)" } });
await bot.text();
await dormir(1500);
ok(visitas() === despues, "una vista previa sin JavaScript (bot) no cuenta");
// La visita de prueba no debe quedar en tus métricas reales.
sql(`update public.visitas_menu v set visitas = greatest(v.visitas - ${despues - antes}, 0) from public.negocios n where n.id = v.negocio_id and n.slug = '${SLUG}' and v.dia = '${hoy}'`);
ok(visitas() === antes, "la visita de prueba se descontó");

ok(errores.length === 0, `sin errores de consola (${errores.length})`);
if (errores.length) console.log(errores.slice(0, 5).join("\n"));
console.log(`\n${res.filter(Boolean).length}/${res.length} pruebas correctas`);
for (const s of [A, O, C]) await s.contexto.close();
await browser.disconnect();
process.exit(res.every(Boolean) ? 0 : 1);
