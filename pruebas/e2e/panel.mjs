import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3100";
const env = Object.fromEntries(readFileSync(new URL("../e2e.env", import.meta.url), "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const CORREO = env.E2E_CORREO;
let CLAVE = env.E2E_CLAVE;
const CLAVE_NUEVA = env.E2E_CLAVE + "-nueva";

const res = [];
const ok = (c, m) => { res.push(!!c); console.log((c ? "OK    " : "FALLA ") + m); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms * 3)); // la red hacia Supabase va lenta desde aquí

const browser = await puppeteer.connect({
  browserWSEndpoint: "ws://127.0.0.1:9222/session",
  protocol: "webDriverBiDi",
  defaultViewport: { width: 390, height: 900 },
});
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });

// ---- ayudantes
const publico = async () => (await (await fetch(BASE + "/nueva-victoria", { cache: "no-store" })).text()).replace(/<!-- -->/g, "");
const filaPub = (h, nombre) => (h.match(new RegExp("<li[^>]*>(?:(?!</li>).)*" + nombre + "(?:(?!</li>).)*</li>", "s")) || [""])[0];
const txt = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const ir = (ruta) => page.goto(BASE + ruta, { waitUntil: "networkidle0" });
const rutaActual = () => new URL(page.url()).pathname;
const poner = (sel, valor) => page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, valor);
const clicBoton = (raiz, texto) => page.evaluate((r, t) => {
  const cont = document.querySelector(r);
  if (!cont) throw new Error("no existe " + r);
  const b = [...cont.querySelectorAll("button")].find((x) => x.textContent.trim() === t || x.getAttribute("aria-label") === t);
  if (!b) throw new Error(`no hay botón "${t}" en ${r}`);
  b.click();
}, raiz, texto);
const abrir = (raiz, resumen) => page.evaluate((r, t) => {
  const s = [...document.querySelector(r).querySelectorAll("summary")].find((x) => x.textContent.includes(t));
  if (!s) throw new Error("no hay resumen " + t);
  if (!s.parentElement.open) s.click();
}, raiz, resumen);
const mensaje = async (raiz, tipo) => {
  await page.waitForFunction((r, t) => !!document.querySelector(`${r} [role=${t}]`), { timeout: 8000 }, raiz, tipo).catch(() => {});
  return page.evaluate((r, t) => document.querySelector(`${r} [role=${t}]`)?.textContent ?? null, raiz, tipo);
};
const nombresPanel = () => page.$$eval("li[data-producto]", (l) => l.map((x) => x.dataset.producto));
const enLogin = async (correo, clave) => {
  await ir("/login");
  await poner("input[name=correo]", correo);
  await poner("input[name=clave]", clave);
  await clicBoton("form", "Entrar");
};
const li = (n) => `li[data-producto="${n}"]`;

// =============================================================== acceso
console.log("--- ACCESO ---");
await ir("/admin");
ok(rutaActual() === "/login", "sin sesión, /admin lleva a /login");

await enLogin(CORREO, "clave-equivocada-123");
const err = await mensaje("form", "alert");
ok(err === "Correo o contraseña incorrectos.", `credenciales malas -> mensaje genérico: "${err}"`);
ok(rutaActual() === "/login", "y se queda en /login");

await enLogin(CORREO, CLAVE);
await page.waitForFunction(() => location.pathname === "/admin", { timeout: 10000 }).catch(() => {});
ok(rutaActual() === "/admin", "login correcto -> /admin");
await ir("/admin/menu");
await page.waitForSelector("li[data-producto]");
ok((await nombresPanel()).length === 16, "el panel lista los 16 productos");

const cookies = await page.cookies?.().catch(() => null);
const sesion = cookies?.filter((c) => c.name.startsWith("sb-")) ?? [];
ok(sesion.length > 0 && sesion.every((c) => c.httpOnly), `cookies de sesión httpOnly (${sesion.length} cookies)`);

await ir("/login");
ok(rutaActual() === "/admin", "con sesión, /login redirige a /admin");

// =============================================================== tasa
console.log("--- TASA ---");
await ir("/admin/configuracion");
for (const [malo, etiqueta] of [["abc", "texto"], ["0", "cero"], ["-5", "negativa"], ["12,12345", "5 decimales"]]) {
  await poner("section[aria-labelledby=tasa] input[name=tasa]", malo);
  await clicBoton("section[aria-labelledby=tasa]", "Guardar tasa");
  const m = await mensaje("section[aria-labelledby=tasa]", "alert");
  ok(m && /tasa/i.test(m), `tasa ${etiqueta} rechazada: "${m}"`);
  await ir("/admin/configuracion");
}
await poner("section[aria-labelledby=tasa] input[name=tasa]", "52,35");
await clicBoton("section[aria-labelledby=tasa]", "Guardar tasa");
ok((await mensaje("section[aria-labelledby=tasa]", "status")) === "Tasa guardada.", "tasa 52,35 guardada");
let h = await publico();
ok(txt(h).includes("Tasa del día: Bs 52,35 por $1"), "el menú público muestra la tasa nueva AL INSTANTE");

// =============================================================== precio
console.log("--- PRECIO Y DISPONIBILIDAD ---");
await ir("/admin/menu");
for (const malo of ["abc", "-1", "1,505", "9999999"]) {
  await poner(`${li("Pan canilla")} input[name=precio]`, malo);
  await clicBoton(li("Pan canilla"), "Guardar");
  const m = await mensaje(li("Pan canilla"), "alert");
  ok(m && /precio/i.test(m), `precio "${malo}" rechazado`);
  await ir("/admin/menu");
}
await poner(`${li("Pan canilla")} input[name=precio]`, "0,80");
await clicBoton(li("Pan canilla"), "Guardar");
ok((await mensaje(li("Pan canilla"), "status")) === "Precio guardado.", "precio 0,80 guardado");
h = await publico();
let f = txt(filaPub(h, "Pan canilla"));
ok(f.includes("$0,80") && f.includes("Bs 41,88"), `público: Pan canilla ${f.match(/\$[\d,]+ Bs [\d.,]+/)?.[0]} (0,80 x 52,35 = 41,88)`);

await ir("/admin/menu");
await clicBoton(li("Pan canilla"), "Disponible");
await page.waitForFunction(() => [...document.querySelectorAll('li[data-producto="Pan canilla"] button')].some((b) => b.textContent.trim() === "Agotado"), { timeout: 8000 }).catch(() => {});
h = await publico();
f = filaPub(h, "Pan canilla");
ok(txt(f).includes("Agotado") && !/aria-label="Agregar Pan canilla"/.test(f), "marcar Agotado: en el menú público sale Agotado y sin botón Agregar");
await clicBoton(li("Pan canilla"), "Agotado");
await page.waitForFunction(() => [...document.querySelectorAll('li[data-producto="Pan canilla"] button')].some((b) => b.textContent.trim() === "Disponible"), { timeout: 8000 }).catch(() => {});
ok(/aria-label="Agregar Pan canilla"/.test(filaPub(await publico(), "Pan canilla")), "volver a Disponible: reaparece el botón Agregar");

// =============================================================== productos
console.log("--- PRODUCTOS ---");
await ir("/admin/menu");
await abrir("section[aria-labelledby=nuevo]", "Agregar producto");
await poner("section[aria-labelledby=nuevo] input[name=nombre]", "Producto E2E");
await poner("section[aria-labelledby=nuevo] input[name=precio]", "2,5");
await poner("section[aria-labelledby=nuevo] input[name=descripcion]", "Solo de prueba");
await page.$eval("section[aria-labelledby=nuevo] select[name=categoria]", (s) => { s.value = [...s.options].find((o) => o.textContent === "Panes").value; });
await clicBoton("section[aria-labelledby=nuevo]", "Agregar");
ok((await mensaje("section[aria-labelledby=nuevo]", "status")) === "Producto agregado.", "producto agregado");
await ir("/admin/menu");
let nombres = await nombresPanel();
ok(nombres.indexOf("Producto E2E") === 4, `queda al final de Panes (posición ${nombres.indexOf("Producto E2E") + 1} de 16+1)`);
ok(txt(filaPub(await publico(), "Producto E2E")).includes("$2,50"), "aparece en el menú público con $2,50");

await abrir("section[aria-labelledby=nuevo]", "Agregar producto");
await poner("section[aria-labelledby=nuevo] input[name=nombre]", "");
await clicBoton("section[aria-labelledby=nuevo]", "Agregar");
await page.waitForFunction(() => document.activeElement && true);
ok(await page.$eval("section[aria-labelledby=nuevo] input[name=nombre]", (i) => !i.validity.valid), "nombre vacío: el navegador lo bloquea (required)");

await clicBoton(li("Producto E2E"), "Subir");
await dormir(1500);
nombres = await nombresPanel();
ok(nombres.indexOf("Producto E2E") === 3, "↑ sube el producto una posición");
await clicBoton(li("Producto E2E"), "Bajar");
await dormir(1500);
ok((await nombresPanel()).indexOf("Producto E2E") === 4, "↓ lo vuelve a bajar");
const primeroPan = li("Pan canilla");
ok(await page.$eval(`${primeroPan} button[aria-label=Subir]`, (b) => b.disabled), "el primero de una categoría no puede subir");

await abrir(li("Producto E2E"), "Más opciones");
await poner(`${li("Producto E2E")} input[name=nombre]`, "Producto E2E editado");
await clicBoton(li("Producto E2E"), "Guardar cambios");
ok((await mensaje(li("Producto E2E editado"), "status")) === "Guardado.", "editar nombre guardado");
await ir("/admin/menu");
ok((await nombresPanel()).includes("Producto E2E editado"), "el panel muestra el nombre nuevo");
ok((await publico()).includes("Producto E2E editado"), "y el menú público también");

await abrir(li("Producto E2E editado"), "Más opciones");
await page.evaluate(() => { const d = [...document.querySelectorAll('li[data-producto="Producto E2E editado"] summary')].find((s) => s.textContent.includes("Borrar producto")); d.click(); });
await clicBoton(li("Producto E2E editado"), "Sí, borrar");
await dormir(1500);
ok(!(await nombresPanel()).includes("Producto E2E editado"), "borrar: desaparece del panel");
ok(!(await publico()).includes("Producto E2E"), "y del menú público");

// =============================================================== categorías
console.log("--- CATEGORÍAS ---");
await ir("/admin/categorias");
await poner("section[aria-labelledby=nueva] input[name=nombre]", "Cat E2E");
await clicBoton("section[aria-labelledby=nueva]", "Agregar");
ok((await mensaje("section[aria-labelledby=nueva]", "status")) === "Categoría creada.", "categoría creada");
await ir("/admin/categorias");
let cats = await page.$$eval("li[data-categoria]", (l) => l.map((x) => x.dataset.categoria));
ok(cats.at(-1) === "Cat E2E", `queda al final: ${cats.join(", ")}`);

await clicBoton('li[data-categoria="Cat E2E"]', "Subir");
await dormir(1500);
cats = await page.$$eval("li[data-categoria]", (l) => l.map((x) => x.dataset.categoria));
ok(cats.indexOf("Cat E2E") === cats.length - 2, "↑ sube la categoría");

await abrir('li[data-categoria="Cat E2E"]', "Renombrar o borrar");
await poner('li[data-categoria="Cat E2E"] input[name=nombre]', "Cat E2E 2");
await clicBoton('li[data-categoria="Cat E2E"]', "Guardar");
ok((await mensaje('li[data-categoria="Cat E2E 2"]', "status")) === "Guardado.", "categoría renombrada");

// Borrar una categoría con productos: los productos se conservan sin categoría.
await ir("/admin/categorias");
await abrir('li[data-categoria="Bebidas"]', "Renombrar o borrar");
await page.evaluate(() => [...document.querySelectorAll('li[data-categoria="Bebidas"] summary')].find((s) => s.textContent.includes("Borrar categoría")).click());
await clicBoton('li[data-categoria="Bebidas"]', "Sí, borrar categoría");
await dormir(1800);
await ir("/admin/menu");
nombres = await nombresPanel();
ok(["Café marrón", "Café con leche", "Jugo natural", "Refresco"].every((n) => nombres.includes(n)), "borrar 'Bebidas': sus 4 productos siguen en el panel");
const titulos = await page.$$eval("section[aria-labelledby=lista] h3", (h3) => h3.map((x) => x.textContent));
ok(titulos.at(-1) === "Sin categoría", `aparecen bajo "Sin categoría" (${titulos.join(" | ")})`);
h = await publico();
ok(h.includes("Café marrón") && !txt(h).includes("Bebidas"), "el menú público los sigue mostrando, sin la categoría");

// =============================================================== ajustes
console.log("--- AJUSTES ---");
await ir("/admin/ajustes");
const aj = "section[aria-labelledby=local]";
await poner(`${aj} input[name=color]`, "rojo");
await clicBoton(aj, "Guardar ajustes");
let m = await mensaje(aj, "alert");
ok(m && m.includes("#RRGGBB"), `color inválido rechazado: "${m}"`);
await ir("/admin/ajustes");
await poner(`${aj} input[name=telefono]`, "123");
await clicBoton(aj, "Guardar ajustes");
m = await mensaje(aj, "alert");
ok(m && /WhatsApp/.test(m), `teléfono inválido rechazado: "${m}"`);
await ir("/admin/ajustes");
await poner(`${aj} input[name=telefono]`, "0414-555 1234");
await poner(`${aj} input[name=horario]`, "Todos los días 7am-5pm");
await poner(`${aj} input[name=color]`, "#0F766E");
await clicBoton(aj, "Guardar ajustes");
ok((await mensaje(aj, "status")) === "Ajustes guardados.", "ajustes válidos guardados");
await ir("/admin/ajustes");
ok((await page.$eval(`${aj} input[name=telefono]`, (i) => i.value)) === "584145551234", "el teléfono se guarda normalizado (584145551234)");
h = await publico();
ok(h.includes("Todos los días 7am-5pm") && h.includes("#0F766E"), "horario y color se ven en el menú público");

// =============================================================== contraseña
console.log("--- CONTRASEÑA Y SALIDA ---");
const cl = "section[aria-labelledby=clave]";
await poner(`${cl} input[name=clave]`, "corta");
await poner(`${cl} input[name=repetir]`, "corta");
ok(await page.$eval(`${cl} input[name=clave]`, (i) => i.required && i.minLength === 10), "contraseña corta: el navegador exige 10 caracteres (minlength)");
await poner(`${cl} input[name=clave]`, "Una-clave-larga-1");
await poner(`${cl} input[name=repetir]`, "Otra-clave-larga-2");
await clicBoton(cl, "Cambiar contraseña");
m = await mensaje(cl, "alert");
ok(m === "Las dos contraseñas no coinciden.", `no coinciden: "${m}"`);
await ir("/admin/ajustes");
await poner(`${cl} input[name=clave]`, CLAVE_NUEVA);
await poner(`${cl} input[name=repetir]`, CLAVE_NUEVA);
await clicBoton(cl, "Cambiar contraseña");
ok((await mensaje(cl, "status")) === "Contraseña actualizada.", "contraseña cambiada");

await page.evaluate(() => [...document.querySelectorAll("header button")].find((b) => b.textContent.trim() === "Salir").click());
await page.waitForFunction(() => location.pathname === "/login", { timeout: 8000 }).catch(() => {});
ok(rutaActual() === "/login", "Salir lleva a /login");
await ir("/admin");
ok(rutaActual() === "/login", "tras salir, /admin vuelve a pedir login");

await enLogin(CORREO, CLAVE);
ok((await mensaje("form", "alert")) === "Correo o contraseña incorrectos.", "la contraseña VIEJA ya no entra");
await enLogin(CORREO, CLAVE_NUEVA);
await page.waitForFunction(() => location.pathname === "/admin", { timeout: 10000 }).catch(() => {});
ok(rutaActual() === "/admin", "la contraseña NUEVA sí entra");

const graves = errores.filter((e) => !/favicon|Failed to load resource/i.test(e));
ok(graves.length === 0, `sin errores de consola (${graves.length})`);
if (graves.length) console.log(graves.join("\n"));

await page.close();
await browser.disconnect();
console.log(`\n${res.filter(Boolean).length}/${res.length} pruebas correctas`);
process.exit(res.every(Boolean) ? 0 : 1);
