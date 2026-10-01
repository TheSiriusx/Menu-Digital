// Conexión que se corta a mitad de una acción (señal mala en el celular): la página no debe romperse ni quedar
// sin estilos; el dueño ve un aviso y puede reintentar. Se simula en el navegador cortando las peticiones de
// las acciones del servidor (cabecera Next-Action): «red» = no hay conexión, «flujo» = la respuesta se corta.
import puppeteer from "puppeteer-core";
import { leerEnv } from "./comun.mjs";

const BASE = "http://localhost:3100";
const S = decodeURIComponent(new URL("..", import.meta.url).pathname);
const env = leerEnv(S + "e2e4.env");
const res = [];
const ok = (c, m) => { res.push(!!c); console.log((c ? "OK    " : "FALLA ") + m); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:9222/session", protocol: "webDriverBiDi", defaultViewport: { width: 1280, height: 900 } });
const contexto = await browser.createBrowserContext();
const page = await contexto.newPage();
const csp = [];
page.on("console", (m) => /Content-Security-Policy/.test(m.text()) && csp.push(m.text()));
page.on("pageerror", (e) => /Content-Security-Policy/.test(String(e)) && csp.push(String(e)));
await page.evaluateOnNewDocument(() => {
  const original = window.fetch.bind(window);
  window.fetch = async (entrada, init) => {
    const cabeceras = new Headers(init?.headers ?? (entrada instanceof Request ? entrada.headers : undefined));
    const modo = sessionStorage.getItem("cortar");
    if (!modo || !cabeceras.has("next-action")) return original(entrada, init);
    if (modo === "red") throw new TypeError("NetworkError when attempting to fetch resource.");
    const r = await original(entrada, init);
    const lector = r.body.getReader();
    const cuerpo = new ReadableStream({
      async pull(c) {
        const { value } = await lector.read();
        if (value) c.enqueue(value.slice(0, Math.max(1, value.length >> 1)));
        c.error(new TypeError("Error in input stream"));
      },
    });
    return new Response(cuerpo, { status: r.status, headers: r.headers });
  };
});
const ir = (r) => page.goto(BASE + r, { waitUntil: "networkidle0" });
const cortar = (modo) => page.evaluate((m) => (m ? sessionStorage.setItem("cortar", m) : sessionStorage.removeItem("cortar")), modo);
const clic = (raiz, texto) => page.evaluate((r, t) => {
  const b = [...document.querySelector(r).querySelectorAll("button")].find((x) => x.textContent.trim() === t);
  if (!b) throw new Error("sin botón " + t);
  b.click();
}, raiz, texto);
// Qué quedó en pantalla tras la acción cortada.
const pantalla = () => page.evaluate(() => ({
  panel: !!document.querySelector("nav[aria-label=Panel]"),
  estilos: getComputedStyle(document.body).fontFamily.includes("Work") || getComputedStyle(document.body).fontFamily.includes("work"),
  texto: document.body.innerText.slice(0, 400),
}));

const hayReintentar = () => page.$$eval("button", (bs) => bs.some((b) => b.textContent.trim() === "Reintentar"));
const corto = (t) => t.replace(/\s+/g, " ").slice(0, 110);

// ---------------------------------------------------------------- acceso (fuera del panel)
await ir("/login");
await page.$eval("input[name=correo]", (e, v) => (e.value = v), env.OWN_CORREO);
await page.$eval("input[name=clave]", (e, v) => (e.value = v), env.OWN_CLAVE);
await cortar("red");
await clic("form", "Entrar");
await dormir(2500);
let p = await pantalla();
ok(p.estilos && /conexi[oó]n/i.test(p.texto) && (await hayReintentar()), `login sin conexión: aviso en español, con estilos y «Reintentar» («${corto(p.texto)}»)`);
await cortar(null);
if (await hayReintentar()) {
  await clic("body", "Reintentar");
  await page.waitForFunction(() => !!document.querySelector("input[name=correo]"), { timeout: 15000 }).catch(() => {});
  ok(!!(await page.$("input[name=correo]")), "«Reintentar» devuelve el formulario de acceso");
}
if (!(await page.$("input[name=correo]"))) await ir("/login");
await page.$eval("input[name=correo]", (e, v) => (e.value = v), env.OWN_CORREO);
await page.$eval("input[name=clave]", (e, v) => (e.value = v), env.OWN_CLAVE);
await clic("form", "Entrar");
await page.waitForFunction(() => location.pathname === "/admin", { timeout: 20000 }).catch(() => {});
ok(new URL(page.url()).pathname === "/admin", "con conexión, el login entra");

// ---------------------------------------------------------------- panel: formulario con mensaje y formulario simple
const fila = 'li[data-producto="Pan canilla"]';
for (const modo of ["red", "flujo"]) {
  for (const boton of ["Guardar", "Disponible"]) {
    await ir("/admin/menu");
    await cortar(modo);
    await clic(fila, boton);
    await dormir(2500);
    p = await pantalla();
    // Si la respuesta se corta después de guardar, el aviso puede ocupar toda la página (sin la barra del panel).
    ok(p.estilos && /conexi[oó]n/i.test(p.texto) && (await hayReintentar()), `${modo} / ${boton}: aviso con estilos y «Reintentar» (${p.panel ? "la barra del panel sigue" : "a página completa"})`);
    await cortar(null);
    if (await hayReintentar()) {
      await clic("body", "Reintentar");
      await page.waitForFunction((f) => !!document.querySelector(f), { timeout: 15000 }, fila).catch(() => {});
      ok(!!(await page.$(fila)), `${modo} / ${boton}: «Reintentar» devuelve el menú del panel`);
    }
  }
}

// ---------------------------------------------------------------- consulta automática del WhatsApp (cada 6 s)
// Si una consulta se corta con el dueño en la página, no debe aparecer ningún error: se reintenta sola.
for (const modo of ["red", "flujo"]) {
  await ir("/admin/configuracion");
  await cortar(modo);
  await dormir(8000);
  p = await pantalla();
  ok(!!(await page.$("#whatsapp")) && !(await hayReintentar()), `${modo}: la consulta del WhatsApp cortada no muestra error (Configuración sigue en pantalla)`);
  await cortar(null);
}

// ---------------------------------------------------------------- dejarlo como estaba
// Con la respuesta cortada el servidor SÍ cambió la disponibilidad: se devuelve desde el panel, que además
// refresca la copia en caché del menú público (si se hiciera por SQL, el menú seguiría viejo hasta 60 s).
await ir("/admin/menu");
if (await page.$eval(fila, (li) => [...li.querySelectorAll("button")].some((b) => b.textContent.trim() === "Agotado"))) {
  await clic(fila, "Agotado");
  await page.waitForFunction((f) => [...document.querySelector(f).querySelectorAll("button")].some((b) => b.textContent.trim() === "Disponible"), { timeout: 15000 }, fila).catch(() => {});
}
ok(await page.$eval(fila, (li) => [...li.querySelectorAll("button")].some((b) => b.textContent.trim() === "Disponible")), "Pan canilla queda disponible, como estaba");

ok(csp.length === 0, `sin violaciones de la CSP (${csp.length})`);
if (csp.length) console.log("   " + csp[0].slice(0, 200));
console.log(`\n${res.filter(Boolean).length}/${res.length} pruebas correctas`);
await contexto.close();
await browser.disconnect();
process.exit(res.every(Boolean) ? 0 : 1);
