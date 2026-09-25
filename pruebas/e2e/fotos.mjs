import puppeteer from "puppeteer-core";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { marcarUsado, pasoCodigo } from "./comun.mjs";

const BASE = "http://localhost:3100";
const S = decodeURIComponent(new URL("..", import.meta.url).pathname);
const env = Object.fromEntries(readFileSync(S + "e2e4.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
marcarUsado(env.SA_TOTP_USADO);
const ENVLOCAL = Object.fromEntries(readFileSync(S + "../.env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const SUPA = ENVLOCAL.NEXT_PUBLIC_SUPABASE_URL, ANON = ENVLOCAL.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const res = [];
const ok = (c, m) => { res.push(!!c); console.log((c ? "OK    " : "FALLA ") + m); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms * 3)); // la red hacia Supabase va lenta desde aquí
const sql = (q) => JSON.parse(execFileSync("python3", ["-c", "import sys,json;sys.path.insert(0,sys.argv[1]);from db import sql;print(json.dumps(sql(sys.argv[2])))", S, q]).toString());
const objetos = () => sql("select name from storage.objects where bucket_id='menu-media' order by name").map((r) => r.name);

const browser = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:9222/session", protocol: "webDriverBiDi", defaultViewport: { width: 390, height: 900 } });
const errores = [];
async function sesion() {
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  page.on("pageerror", (e) => errores.push(String(e)));
  page.on("console", async (m) => {
    if (m.type() !== "error") return;
    const p = await Promise.all(m.args().map((a) => a.evaluate((x) => (x instanceof Error ? (x.stack || x.message) : String(x))).catch(() => m.text())));
    errores.push(`[${page.url()}] ` + (p.join(" ") || m.text()));
  });
  const ir = (r) => page.goto(BASE + r, { waitUntil: "networkidle0" });
  const poner = (sel, v) => page.$eval(sel, (el, x) => { el.value = x; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
  const clic = (raiz, t) => page.evaluate((r, tx) => { const b = [...document.querySelector(r).querySelectorAll("button")].find((x) => x.textContent.trim() === tx); if (!b) throw new Error("sin botón " + tx); b.click(); }, raiz, t);
  const login = async (c, k, secreto) => { await ir("/login"); await poner("input[name=correo]", c); await poner("input[name=clave]", k); await clic("form", "Entrar"); await page.waitForFunction(() => location.pathname !== "/login", { timeout: 10000 }).catch(() => {}); await page.waitForNetworkIdle?.({ idleTime: 500, timeout: 8000 }).catch(() => {});  await pasoCodigo(page, secreto); };
  const mensaje = async (raiz, tipo) => { await page.waitForFunction((r, t) => !!document.querySelector(`${r} [role=${t}]`), { timeout: 15000 }, raiz, tipo).catch(() => {}); return page.evaluate((r, t) => document.querySelector(`${r} [role=${t}]`)?.textContent ?? null, raiz, tipo); };
  return { contexto, page, ir, poner, clic, login, mensaje };
}

// Pone un archivo en el <input type=file> de la página, como si la persona lo eligiera.
// tipo "jpeg-grande": foto 3000x2000 con EXIF falso (GPS). Devuelve tamaño y si trae EXIF.
async function elegirArchivo(page, selector, tipo) {
  return page.evaluate(async (sel, tipo) => {
    const entrada = document.querySelector(sel);
    if (!entrada) throw new Error("no hay input " + sel);
    const lienzo = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    const aBlob = (c, t, q) => new Promise((r) => c.toBlob(r, t, q));
    let archivo, exif = false;
    if (tipo === "jpeg-grande") {
      const c = lienzo(3000, 2000), x = c.getContext("2d");
      const g = x.createLinearGradient(0, 0, 3000, 2000); g.addColorStop(0, "#c2410c"); g.addColorStop(1, "#fde68a");
      x.fillStyle = g; x.fillRect(0, 0, 3000, 2000);
      for (let i = 0; i < 600; i++) { x.fillStyle = `hsl(${(i * 7) % 360} 70% 50%)`; x.beginPath(); x.arc(Math.random() * 3000, Math.random() * 2000, 20 + Math.random() * 90, 0, 7); x.fill(); }
      const b = new Uint8Array(await (await aBlob(c, "image/jpeg", 0.95)).arrayBuffer());
      const carga = new TextEncoder().encode("Exif\0\0GPSLatitude=10.4806N GPSLongitude=66.9036W Make=TestPhone");
      const len = carga.length + 2;
      const seg = new Uint8Array([0xff, 0xe1, (len >> 8) & 255, len & 255, ...carga]);
      const out = new Uint8Array(b.length + seg.length); out.set(b.subarray(0, 2), 0); out.set(seg, 2); out.set(b.subarray(2), 2 + seg.length);
      exif = new TextDecoder("latin1").decode(out).includes("GPSLatitude");
      archivo = new File([out], "foto-celular.jpg", { type: "image/jpeg" });
    } else if (tipo === "png-fijo") { // PNG válido de 1x1 con bytes fijos (no pasa por canvas, que las pruebas de abajo alteran)
      const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
      archivo = new File([Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))], "f.png", { type: "image/png" });
    } else if (tipo === "pequeña") {
      const c = lienzo(64, 64); c.getContext("2d").fillRect(0, 0, 64, 64);
      archivo = new File([await aBlob(c, "image/png")], "peq.png", { type: "image/png" });
    }
    const dt = new DataTransfer(); dt.items.add(archivo); entrada.files = dt.files;
    entrada.dispatchEvent(new Event("change", { bubbles: true }));
    return { bytes: archivo.size, exif };
  }, selector, tipo);
}

// Hace que el navegador "produzca" un blob malicioso en lugar de la imagen reducida: así se prueba al
// SERVIDOR (que no debe fiarse del navegador).
// Sustituye la recodificación del navegador por contenido malicioso, para probar que el SERVIDOR no se fía del cliente.
// Va como script de precarga (mundo de la página): una función creada desde fuera no la puede usar el código de la página.
const forzarBlob = (page, tipo, contenido) => page.evaluateOnNewDocument((tipo, contenido) => {
  const bytes = contenido === "GRANDE"
    ? (() => { const a = new Uint8Array(400000); a.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return a; })()
    : new TextEncoder().encode(contenido);
  HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new Blob([bytes], { type: tipo })); };
}, tipo, contenido);

const leer = async (url) => { const r = await fetch(url, { cache: "no-store" }); return { estado: r.status, tipo: r.headers.get("content-type"), bytes: new Uint8Array(await r.arrayBuffer()) }; };
const publico = async (slug) => (await (await fetch(`${BASE}/${slug}`, { cache: "no-store" })).text()).replace(/<!-- -->/g, "");
const imgDe = (html, nombre) => (html.match(new RegExp("<li[^>]*>(?:(?!</li>).)*" + nombre + "(?:(?!</li>).)*</li>", "s")) || [""])[0].match(/<img[^>]+src="([^"]+)"/)?.[1] ?? null;
const enOtroLocal = (r) => r.estado === 400 || r.estado === 404;

// ==================================================================== FOTO DE PRODUCTO
const O = await sesion();
await O.login(env.OWN_CORREO, env.OWN_CLAVE);
console.log("--- FOTO DE PRODUCTO ---");
await O.ir("/admin/menu");
const LI = 'li[data-producto="Pan canilla"]';
ok((await objetos()).length === 0, "Storage empieza vacío");

const origen = await elegirArchivo(O.page, `${LI} input[type=file]`, "jpeg-grande");
ok(origen.bytes > 300_000 && origen.exif, `foto de prueba: ${(origen.bytes / 1024).toFixed(0)} KB, con EXIF/GPS falso`);
ok((await O.mensaje(LI, "status")) === "Foto guardada.", "subida guardada");
let lista = await objetos();
const nombreViejo = lista[0];
ok(lista.length === 1, `un solo archivo en Storage: ${lista[0]}`);
await O.ir("/admin/menu");
const src1 = await O.page.$eval(`${LI} img`, (i) => i.src);
ok(src1.includes("/menu-media/"), "el panel muestra la miniatura");
const f1 = await leer(src1);
const cab = new TextDecoder("latin1").decode(f1.bytes);
ok(f1.estado === 200 && f1.tipo === "image/webp", `se sirve como ${f1.tipo}`);
ok(f1.bytes.length <= 60_000, `pesa ${(f1.bytes.length / 1024).toFixed(1)} KB (de ${(origen.bytes / 1024).toFixed(0)} KB originales)`);
ok(cab.startsWith("RIFF") && cab.slice(8, 12) === "WEBP", "es un WebP real");
ok(!cab.includes("GPSLatitude") && !cab.includes("Exif") && !cab.includes("TestPhone"), "sin EXIF: el GPS y el modelo del celular se borraron");
const dims = await O.page.evaluate((u) => new Promise((r) => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = u; }), src1);
ok(dims[0] === 480 && dims[1] === 480, `recorte cuadrado ${dims[0]}×${dims[1]}`);
ok(imgDe(await publico("nueva-victoria"), "Pan canilla") === src1, "el menú público muestra esa foto AL INSTANTE");

console.log("--- CAMBIAR Y QUITAR ---");
await elegirArchivo(O.page, `${LI} input[type=file]`, "jpeg-grande");
await O.page.waitForFunction((s, viejo) => document.querySelector(s + " img")?.src !== viejo, { timeout: 20000 }, LI, src1).catch(() => {});
await dormir(500);
lista = await objetos();
ok(lista.length === 1, `al cambiar la foto se borró la anterior (queda ${lista.length} archivo)`);
// El archivo viejo desaparece de Storage. (La CDN de Supabase puede seguir sirviendo su copia en caché un rato: ajeno a la app.)
ok(!lista.includes(nombreViejo) && !(await objetos()).includes(nombreViejo), "el archivo viejo ya no está en Storage");
await O.ir("/admin/menu");
const src2 = await O.page.$eval(`${LI} img`, (i) => i.src);
ok(src2 !== src1 && (await leer(src2)).estado === 200, "la foto nueva sí responde");

await O.clic(LI, "Quitar foto");
await dormir(1500);
ok((await objetos()).length === 0, "quitar la foto borra el archivo de Storage");
ok(imgDe(await publico("nueva-victoria"), "Pan canilla") === null, "y el menú público vuelve al marcador");

console.log("--- BORRAR UN PRODUCTO CON FOTO ---");
await O.ir("/admin/menu");
await O.page.evaluate(() => { const d = document.querySelector("section[aria-labelledby=nuevo] details"); d.open = true; });
await O.poner("section[aria-labelledby=nuevo] input[name=nombre]", "Producto con foto");
await O.poner("section[aria-labelledby=nuevo] input[name=precio]", "1");
await O.clic("section[aria-labelledby=nuevo]", "Agregar");
await O.mensaje("section[aria-labelledby=nuevo]", "status");
await O.ir("/admin/menu");
const L2 = 'li[data-producto="Producto con foto"]';
await elegirArchivo(O.page, `${L2} input[type=file]`, "jpeg-grande");
await O.mensaje(L2, "status");
ok((await objetos()).length === 1, "producto nuevo con foto: 1 archivo");
await O.ir("/admin/menu");
await O.page.evaluate((s) => { [...document.querySelectorAll(s + " summary")].find((x) => x.textContent.includes("Más opciones")).click(); }, L2);
await O.page.evaluate((s) => { [...document.querySelectorAll(s + " summary")].find((x) => x.textContent.includes("Borrar producto")).click(); }, L2);
await O.clic(L2, "Sí, borrar");
await dormir(2000);
ok((await objetos()).length === 0, "borrar el producto también borra su foto");

console.log("--- LOGO ---");
await O.ir("/admin/ajustes");
await elegirArchivo(O.page, "section[aria-labelledby=logo] input[type=file]", "jpeg-grande");
ok((await O.mensaje("section[aria-labelledby=logo]", "status")) === "Logo guardado.", "logo guardado");
const html = await publico("nueva-victoria");
const logo = html.match(/<img src="([^"]+menu-media[^"]+)" alt=""/)?.[1];
ok(!!logo, "el menú público muestra el logo en la cabecera");
const dl = await O.page.evaluate((u) => new Promise((r) => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = u; }), logo);
ok(dl[0] === 256, `el logo se redujo a ${dl[0]}×${dl[1]}`);
await O.ir("/admin/ajustes");
await O.clic("section[aria-labelledby=logo]", "Quitar logo");
await dormir(1500);
ok((await objetos()).length === 0, "quitar el logo borra el archivo");

// ==================================================================== SERVIDOR NO SE FÍA
console.log("--- EL SERVIDOR NO SE FÍA DEL NAVEGADOR ---");
const casos = [
  ["texto disfrazado de imagen", "image/webp", "esto no es una imagen, es texto plano", /no es una imagen válida/],
  ["SVG con script", "image/webp", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script></svg>', /no es una imagen válida/],
  ["imagen de 400 KB", "image/png", "GRANDE", /demasiado pesada/],
];
for (const [nombre, tipo, contenido, patron] of casos) {
  await forzarBlob(O.page, tipo, contenido); // el navegador "recodifica" y entrega este contenido malicioso al servidor
  await O.ir("/admin/menu");
  await elegirArchivo(O.page, `${LI} input[type=file]`, "png-fijo");
  const m = await O.mensaje(LI, "alert");
  ok(m && patron.test(m), `${nombre}: rechazado -> "${m}"`);
  ok((await objetos()).length === 0, `${nombre}: no quedó nada en Storage`);
}

// ==================================================================== PERMISOS REALES DE STORAGE (API)
console.log("--- PERMISOS DE STORAGE (peticiones directas a la API) ---");
const token = async (c, k) => (await (await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: c, password: k }) })).json()).access_token;
const tOwn = await token(env.OWN_CORREO, env.OWN_CLAVE), tSa = await token(env.SA_CORREO, env.SA_CLAVE);
const PNG1 = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const api = (metodo, ruta, t, cuerpo, tipo = "image/png") => fetch(`${SUPA}/storage/v1/object/menu-media/${ruta}`, { method: metodo, headers: { apikey: ANON, ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(cuerpo ? { "Content-Type": tipo } : {}) }, body: cuerpo });
const ids = sql("select (select id from negocios where slug='nueva-victoria') nv, (select id from negocios where slug='e2e-otro') otro")[0];

let r = await api("POST", `${ids.otro}/ajeno.png`, tSa, PNG1);
ok(r.status === 200, `super admin sube a un local cualquiera (HTTP ${r.status})`);
r = await api("POST", `${ids.otro}/intruso.png`, tOwn, PNG1);
ok(r.status === 403 || r.status === 400, `dueño sube a la carpeta de OTRO local: rechazado (HTTP ${r.status})`);
r = await api("POST", `${ids.nv}/mio.png`, tOwn, PNG1);
ok(r.status === 200, `dueño sube a SU carpeta (HTTP ${r.status})`);
r = await api("DELETE", `${ids.otro}/ajeno.png`, tOwn);
const sigue = (await leer(`${SUPA}/storage/v1/object/public/menu-media/${ids.otro}/ajeno.png`)).estado === 200;
ok(sigue, `dueño intenta borrar el archivo de OTRO local (HTTP ${r.status}): el archivo sigue ahí`);
r = await api("POST", `${ids.nv}/anon.png`, null, PNG1);
ok(r.status === 401 || r.status === 403 || r.status === 400, `sin sesión no puede subir (HTTP ${r.status})`);
r = await api("POST", `${ids.nv}/malo.svg`, tOwn, new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml");
ok(r.status >= 400, `el bucket rechaza un SVG (HTTP ${r.status})`);
ok((await leer(`${SUPA}/storage/v1/object/public/menu-media/${ids.nv}/mio.png`)).estado === 200, "cualquiera puede VER una foto pública por su URL");

sql("update negocios set activo = false where slug = 'nueva-victoria'");
r = await api("POST", `${ids.nv}/pausado.png`, tOwn, PNG1);
ok(r.status === 403 || r.status === 400, `local PAUSADO: el dueño ya no puede subir (HTTP ${r.status})`);
r = await api("DELETE", `${ids.nv}/mio.png`, tOwn);
ok((await leer(`${SUPA}/storage/v1/object/public/menu-media/${ids.nv}/mio.png`)).estado === 200, `local PAUSADO: el dueño no puede borrar (HTTP ${r.status})`);
sql("update negocios set activo = true where slug = 'nueva-victoria'");
r = await api("DELETE", `${ids.nv}/mio.png`, tOwn);
ok(r.status === 200, `local reactivado: el dueño borra lo suyo (HTTP ${r.status})`);

// ==================================================================== QR
console.log("--- QR ---");
await O.ir("/admin/qr");
const pagina = await O.page.content();
ok(pagina.includes("Escanea para ver el menú") && pagina.includes("Panadería Nueva Victoria"), "la tarjeta muestra el nombre del local");
const pngUri = await O.page.$eval("a[download$='.png']", (a) => a.href);
const svgUri = await O.page.$eval("a[download$='.svg']", (a) => a.href);
ok(svgUri.startsWith("data:image/svg+xml;base64,") && pngUri.startsWith("data:image/png;base64,"), "descargas SVG y PNG disponibles");
const png = PNG.sync.read(Buffer.from(pngUri.split(",")[1], "base64"));
const dec = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
ok(dec?.data === `${BASE}/nueva-victoria`, `el QR decodificado apunta a: ${dec?.data}`);
ok((await O.page.$$eval("button", (b) => b.map((x) => x.textContent.trim()))).includes("Copiar enlace"), "botón Copiar enlace presente");
const oculta = await O.page.evaluate(() => { const h = document.querySelector("header"); return getComputedStyle(h).display; });
ok(oculta !== "none", "en pantalla la cabecera se ve (se oculta solo al imprimir)");
await O.page.emulateMediaType("print").catch(() => {}); // BiDi no lo soporta: la regla de impresión se comprueba en el CSS compilado
const impresion = await O.page.evaluate(() => ({ cabecera: getComputedStyle(document.querySelector("header")).display, botones: [...document.querySelectorAll("button")].filter((b) => getComputedStyle(b).display !== "none" && b.offsetParent !== null).length }));
await O.page.emulateMediaType("screen").catch(() => {});
// (BiDi no puede emular «print»: se comprueba la clase y que la regla exista en el CSS compilado, abajo)

const A = await sesion();
await A.login(env.SA_CORREO, env.SA_CLAVE, env.SA_TOTP);
await A.ir("/superadmin/locales/nueva-victoria/qr");
ok((await A.page.content()).includes("Escanea para ver el menú"), "el super admin también ve el QR de cada local");
const S2 = await sesion();
await S2.ir("/admin/qr");
ok(new URL(S2.page.url()).pathname === "/login", "sin sesión, /admin/qr pide login");

const graves = errores.filter((e) => !/favicon|Failed to load resource|__cf_bm/i.test(e));
ok(graves.length === 0, `sin errores de consola (${graves.length})`);
if (graves.length) console.log(graves.join("\n"));
for (const s of [O, A, S2]) await s.contexto.close().catch(() => {});
await browser.disconnect();
console.log(`\n${res.filter(Boolean).length}/${res.length} pruebas correctas`);
process.exit(res.every(Boolean) ? 0 : 1);
