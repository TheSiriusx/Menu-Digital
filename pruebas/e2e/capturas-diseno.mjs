// Capturas del nuevo diseño (menú, pedido, login y panel) en celular y computadora, para revisarlas a ojo.
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { leerEnv } from "./comun.mjs";
const S = decodeURIComponent(new URL("..", import.meta.url).pathname);
const env = leerEnv(S + "e2e4.env");
const BASE = "http://localhost:3100";
mkdirSync(S + "shots", { recursive: true });
const b = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:9222/session", protocol: "webDriverBiDi" });
const c = await b.createBrowserContext();
const p = await c.newPage();
const errores = [];
p.on("pageerror", (e) => errores.push(String(e)));
p.on("console", (m) => m.type() === "error" && errores.push(m.text()));
const foto = async (nombre, completa = true) => { await new Promise((r) => setTimeout(r, 600)); await p.screenshot({ path: `${S}shots/diseno-${nombre}.png`, fullPage: completa }); };
const ir = (r) => p.goto(BASE + r, { waitUntil: "networkidle0" });

for (const [w, h, n] of [[390, 844, "cel"], [1280, 860, "pc"]]) {
  await p.setViewport({ width: w, height: h });
  await ir("/nueva-victoria");
  await foto(`menu-${n}`, false);
  await p.evaluate(() => [...document.querySelectorAll("button")].filter((x) => (x.getAttribute("aria-label") || "").startsWith("Agregar ")).slice(0, 2).forEach((x) => x.click()));
  await new Promise((r) => setTimeout(r, 400));
  await foto(`menu-carrito-${n}`, false);
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Ver mi pedido"))?.click());
  await foto(`pedido-${n}`, false);
  await p.evaluate(() => localStorage.clear());
  await ir("/login");
  await foto(`login-${n}`, false);
}
await p.setViewport({ width: 1280, height: 860 });
await p.$eval("input[name=correo]", (e, v) => (e.value = v), env.OWN_CORREO);
await p.$eval("input[name=clave]", (e, v) => (e.value = v), env.OWN_CLAVE);
await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Entrar").click());
await p.waitForFunction(() => location.pathname === "/admin", { timeout: 20000 }).catch(() => {});
for (const [w, h, n] of [[1280, 860, "pc"], [390, 844, "cel"]]) {
  await p.setViewport({ width: w, height: h });
  for (const r of ["", "/menu", "/pedidos", "/configuracion"]) {
    await ir("/admin" + r);
    await foto(`panel${r.replace("/", "-") || "-dashboard"}-${n}`, r !== "/menu");
  }
}
console.log("errores:", errores.length, errores.slice(0, 5));
await c.close(); await b.disconnect();
