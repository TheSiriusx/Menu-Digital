// Capturas de pantalla: node capturas.mjs <puerto> <etiqueta> [conjunto]
import puppeteer from "puppeteer-core";
import { readFileSync, mkdirSync } from "node:fs";

const [puerto, etiqueta, conjunto = "todo"] = process.argv.slice(2);
const S = decodeURIComponent(new URL("..", import.meta.url).pathname);
const env = Object.fromEntries(readFileSync(S + "e2e4.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const OUT = S + "shots/"; mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3100";
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.connect({ browserWSEndpoint: `ws://127.0.0.1:${puerto}/session`, protocol: "webDriverBiDi" });
async function sesion(ancho = 390, alto = 844) {
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  await page.setViewport({ width: ancho, height: alto });
  return { contexto, page };
}
const foto = async (page, nombre, opciones = {}) => { await dormir(400); await page.screenshot({ path: `${OUT}${etiqueta}-${nombre}.png`, ...opciones }); console.log("captura:", `${etiqueta}-${nombre}.png`); };
const login = async (page, c, k) => {
  await page.goto(BASE + "/login", { waitUntil: "networkidle0" });
  await page.$eval("input[name=correo]", (e, v) => (e.value = v), c);
  await page.$eval("input[name=clave]", (e, v) => (e.value = v), k);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Entrar").click());
  await page.waitForFunction(() => location.pathname !== "/login", { timeout: 10000 }).catch(() => {});
  await page.waitForNetworkIdle?.({ idleTime: 500, timeout: 8000 }).catch(() => {});
};

if (conjunto === "todo" || conjunto === "publico") {
  const { contexto, page } = await sesion();
  await page.goto(BASE + "/nueva-victoria", { waitUntil: "networkidle0" });
  await foto(page, "menu-movil");
  await foto(page, "menu-movil-completo", { fullPage: true });
  // con carrito y pedido abierto
  await page.evaluate(() => { document.querySelectorAll('button[aria-label^="Agregar "]').forEach((b, i) => { if (i < 2) b.click(); }); });
  await dormir(300);
  await page.evaluate(() => document.querySelector('button[aria-label^="Agregar "]')?.click());
  await foto(page, "menu-con-carrito");
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Ver pedido")).click());
  await foto(page, "pedido");
  await contexto.close();
}
if (conjunto === "todo" || conjunto === "escritorio") {
  const { contexto, page } = await sesion(1280, 800);
  await page.goto(BASE + "/nueva-victoria", { waitUntil: "networkidle0" });
  await foto(page, "menu-escritorio");
  await contexto.close();
}
if (conjunto === "todo" || conjunto === "panel") {
  const { contexto, page } = await sesion();
  await page.goto(BASE + "/login", { waitUntil: "networkidle0" });
  await foto(page, "login");
  await login(page, env.OWN_CORREO, env.OWN_CLAVE);
  await page.goto(BASE + "/admin", { waitUntil: "networkidle0" });
  await foto(page, "panel-productos", { fullPage: true });
  await page.goto(BASE + "/admin/ajustes", { waitUntil: "networkidle0" });
  await foto(page, "panel-ajustes", { fullPage: true });
  await page.goto(BASE + "/admin/qr", { waitUntil: "networkidle0" });
  await foto(page, "panel-qr", { fullPage: true });
  await contexto.close();
  const b = await sesion();
  await login(b.page, env.SA_CORREO, env.SA_CLAVE);
  await b.page.goto(BASE + "/superadmin", { waitUntil: "networkidle0" });
  await foto(b.page, "superadmin", { fullPage: true });
  await b.contexto.close();
}
await browser.disconnect();
