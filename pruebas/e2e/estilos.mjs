// Regresión de la lección "constantes en use client": los campos de formulario deben verse estilados y ninguna
// clase CSS puede contener texto de error. Recorre las pantallas del dueño y del super admin en 390 px.
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
import { pasoCodigo } from "./comun.mjs";

const S = decodeURIComponent(new URL("..", import.meta.url).pathname);
const env = Object.fromEntries(readFileSync(S + "e2e4.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const b = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:9222/session", protocol: "webDriverBiDi" });
let fallos = 0;
async function revisar(page, ruta) {
  await page.goto("http://localhost:3100" + ruta, { waitUntil: "networkidle0" });
  const r = await page.evaluate(() => {
    const malas = [...document.querySelectorAll("[class]")].filter((e) => /function\s*\(|throw\s+Error|\[native code\]/.test(e.getAttribute("class"))).length;
    const campos = [...document.querySelectorAll("input:not([type=hidden]):not([type=file]):not([type=radio]):not([type=checkbox]):not([type=color]), select, textarea")];
    const sinEstilo = campos.filter((c) => { const s = getComputedStyle(c); return parseFloat(s.borderTopWidth) < 1 || parseFloat(s.borderTopLeftRadius) < 4; }).length;
    return { malas, campos: campos.length, sinEstilo };
  });
  const ok = r.malas === 0 && r.sinEstilo === 0;
  if (!ok) fallos++;
  console.log((ok ? "OK    " : "FALLA ") + `${ruta}: ${r.campos} campos, ${r.sinEstilo} sin estilo, ${r.malas} clases con texto de error`);
}
async function conSesion(correo, clave, rutas, secreto) {
  const c = await b.createBrowserContext(); const p = await c.newPage(); await p.setViewport({ width: 390, height: 900 });
  await p.goto("http://localhost:3100/login", { waitUntil: "networkidle0" });
  await revisar(p, "/login");
  await p.$eval("input[name=correo]", (e, v) => (e.value = v), correo); await p.$eval("input[name=clave]", (e, v) => (e.value = v), clave);
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Entrar").click());
  await p.waitForFunction(() => location.pathname !== "/login", { timeout: 10000 }).catch(() => {});
  await p.waitForNetworkIdle?.({ idleTime: 600 }).catch(() => {});
  await pasoCodigo(p, secreto);
  for (const r of rutas) await revisar(p, r);
  await c.close();
}
await conSesion(env.OWN_CORREO, env.OWN_CLAVE, ["/admin", "/admin/menu", "/admin/pedidos", "/admin/clientes", "/admin/configuracion"]);
await conSesion(env.SA_CORREO, env.SA_CLAVE, ["/superadmin", "/superadmin/locales/nueva-victoria", "/superadmin/locales/nueva-victoria/menu", "/superadmin/locales/nueva-victoria/configuracion"], env.SA_TOTP);
await b.disconnect();
console.log(fallos ? `\n${fallos} pantallas con problemas` : "\nTodas las pantallas con campos bien estilados");
process.exit(fallos ? 1 : 0);
