// Revisa en PRODUCCIÓN que la sección «WhatsApp de pedidos» vea a Evolution (estado y botón para vincular).
import puppeteer from "puppeteer-core";
import { leerEnv } from "./comun.mjs";
const S = decodeURIComponent(new URL("..", import.meta.url).pathname);
const env = leerEnv(S + "e2e4.env");
// Dirección de producción: la misma NEXT_PUBLIC_BASE_URL de Vercel (NEXT_PUBLIC_BASE_URL=https://… node whatsapp-prod.mjs).
const BASE = (process.env.NEXT_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
if (!BASE) throw new Error("Falta NEXT_PUBLIC_BASE_URL con la dirección de producción");
const b = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:9222/session", protocol: "webDriverBiDi", defaultViewport: { width: 1280, height: 900 } });
const c = await b.createBrowserContext(); const p = await c.newPage();
await p.goto(BASE + "/login", { waitUntil: "networkidle0" });
await p.$eval("input[name=correo]", (e, v) => (e.value = v), env.OWN_CORREO);
await p.$eval("input[name=clave]", (e, v) => (e.value = v), env.OWN_CLAVE);
await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Entrar").click());
await p.waitForFunction(() => location.pathname === "/admin", { timeout: 30000 }).catch(() => {});
await p.goto(BASE + "/admin/configuracion", { waitUntil: "networkidle0" });
await p.waitForFunction(() => { const e = document.querySelector("[data-estado-whatsapp]"); return e && e.textContent !== "Consultando…"; }, { timeout: 40000 }).catch(() => {});
const r = await p.evaluate(() => {
  const s = document.querySelector("section[aria-labelledby=whatsapp]");
  return { estado: s.querySelector("[data-estado-whatsapp]")?.dataset.estadoWhatsapp, texto: s.innerText.replace(/\s+/g, " ").slice(0, 300), botones: [...s.querySelectorAll("button")].map((x) => x.textContent.trim()) };
});
console.log(JSON.stringify(r, null, 1));
await c.close(); await b.disconnect();
