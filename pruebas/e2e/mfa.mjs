import puppeteer from "puppeteer-core";
import { codigoFresco, leerEnv, marcarUsado, totp } from "./comun.mjs";

const BASE = "http://localhost:3100";
const S = decodeURIComponent(new URL("..", import.meta.url).pathname);
const env = leerEnv(S + "e2e4.env");
marcarUsado(env.SA_TOTP_USADO);
const res = [];
const ok = (c, m) => { res.push(!!c); console.log((c ? "OK    " : "FALLA ") + m); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:9222/session", protocol: "webDriverBiDi", defaultViewport: { width: 390, height: 900 } });
const violaciones = [];
async function sesion() {
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  await page.evaluateOnNewDocument(() => { window.__csp = []; document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(e.violatedDirective + " " + e.blockedURI)); });
  const ruta = () => new URL(page.url()).pathname;
  const ir = (r) => page.goto(BASE + r, { waitUntil: "networkidle0" });
  const poner = (sel, v) => page.$eval(sel, (el, x) => { el.value = x; }, v);
  const clic = (t) => page.evaluate((tx) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === tx); if (!b) throw new Error("sin botón " + tx); b.click(); }, t);
  const esperarRuta = (fn) => page.waitForFunction(fn, { timeout: 12000 }).catch(() => {});
  const quieta = () => page.waitForNetworkIdle?.({ idleTime: 600, timeout: 8000 }).catch(() => {});
  const contraseña = async (c, k) => { await ir("/login"); await poner("input[name=correo]", c); await poner("input[name=clave]", k); await clic("Entrar"); await esperarRuta(() => location.pathname !== "/login"); await quieta(); };
  const texto = () => page.evaluate(() => document.body.innerText);
  const alerta = async () => { await page.waitForFunction(() => !!document.querySelector("[role=alert]"), { timeout: 8000 }).catch(() => {}); return page.evaluate(() => document.querySelector("[role=alert]")?.textContent ?? null); };
  const csp = async () => { const v = await page.evaluate(() => window.__csp); violaciones.push(...v); return v; };
  return { contexto, page, ruta, ir, poner, clic, esperarRuta, quieta, contraseña, texto, alerta, csp };
}

// ======================================================================= SUPER ADMIN CON FACTOR
console.log("--- SUPER ADMIN YA INSCRITO ---");
const A = await sesion();
await A.contraseña(env.SA_CORREO, env.SA_CLAVE);
ok(A.ruta() === "/login/verificar", `tras la contraseña se pide el código (${A.ruta()})`);
ok((await A.texto()).includes("Verificación en dos pasos"), "pantalla «Verificación en dos pasos»");
for (const r of ["/superadmin", "/superadmin/locales/nueva-victoria", "/superadmin/cuenta", "/superadmin/mfa"]) {
  await A.ir(r);
  ok(A.ruta() === "/login/verificar", `sin código, ${r} lleva a verificar`);
}
await A.ir("/login/verificar");
await A.poner("input[name=codigo]", "000000");
await A.clic("Verificar");
const e1 = await A.alerta();
ok(e1 && e1.includes("incorrecto"), `código incorrecto rechazado: "${e1}"`);
ok(A.ruta() === "/login/verificar", "y no avanza");
await A.ir("/login/verificar");
await A.page.evaluate(() => { document.querySelector("form").noValidate = true; });
await A.poner("input[name=codigo]", "12345");
await A.clic("Verificar");
const e2 = await A.alerta();
ok(e2 && e2.includes("6 dígitos"), `formato inválido (5 dígitos) rechazado por el servidor: "${e2}"`);
await A.ir("/login/verificar");
await A.poner("input[name=codigo]", await codigoFresco(env.SA_TOTP));
await A.clic("Verificar");
await A.esperarRuta(() => location.pathname === "/superadmin");
await A.quieta();
ok(A.ruta() === "/superadmin", `código correcto -> /superadmin (${A.ruta()})`);
ok((await A.texto()).includes("Panadería Nueva Victoria"), "y ve la lista de locales");
await A.ir("/login/verificar");
ok(A.ruta() === "/superadmin", "con el segundo factor ya verificado, /login/verificar no vuelve a pedirlo");
await A.ir("/superadmin/mfa");
ok((await A.texto()).includes("Activada"), "la pantalla de seguridad indica que la verificación está activada");
await A.csp();

const A2 = await sesion();
await A2.contraseña(env.SA_CORREO, env.SA_CLAVE);
ok(A2.ruta() === "/login/verificar", "una sesión nueva vuelve a pedir el código (no se hereda)");
await A2.contexto.close();

// ======================================================================= SUPER ADMIN SIN FACTOR
console.log("--- SUPER ADMIN SIN INSCRIBIR ---");
const B = await sesion();
await B.contraseña(env.SA2_CORREO, env.SA2_CLAVE);
ok(B.ruta() === "/superadmin/mfa", `sin factor, entra directo a inscribirse (${B.ruta()})`);
for (const r of ["/superadmin", "/superadmin/locales/nueva-victoria", "/superadmin/cuenta"]) {
  await B.ir(r);
  ok(B.ruta() === "/superadmin/mfa", `sin factor, ${r} lleva a la inscripción`);
}
await B.ir("/superadmin/mfa");
ok((await B.texto()).includes("Activar verificación en dos pasos"), "botón «Activar verificación en dos pasos»");
await B.clic("Activar verificación en dos pasos");
await B.page.waitForSelector("[data-secreto]", { timeout: 15000 }).catch(() => {});
const secreto = await B.page.$eval("[data-secreto]", (e) => e.textContent.trim()).catch(() => null);
ok(secreto && /^[A-Z2-7]{16,}$/.test(secreto), `muestra el código secreto de respaldo (${secreto ? secreto.length : 0} caracteres)`);
const qr = await B.page.evaluate(() => { const i = document.querySelector('img[alt^="Código QR"]'); return i ? { ok: i.naturalWidth > 0, src: i.src.slice(0, 30) } : null; });
ok(qr && qr.ok, `muestra el QR (${qr?.src})`);
await B.poner("input[name=codigo]", "111111");
await B.clic("Confirmar y activar");
const e3 = await B.alerta();
ok(e3 && e3.includes("incorrecto"), `primer código incorrecto rechazado: "${e3}"`);
ok(B.ruta() === "/superadmin/mfa", "y sigue en la inscripción");
const codigo = await codigoFresco(secreto);
await B.poner("input[name=codigo]", codigo);
await B.clic("Confirmar y activar");
await B.esperarRuta(() => location.pathname === "/superadmin");
await B.quieta();
ok(B.ruta() === "/superadmin", `código correcto activa la verificación y entra (${B.ruta()})`);
await B.csp();
await B.page.evaluate(() => [...document.querySelectorAll("header button")].find((b) => b.textContent.trim() === "Salir").click());
await B.esperarRuta(() => location.pathname === "/login");
await B.contraseña(env.SA2_CORREO, env.SA2_CLAVE);
ok(B.ruta() === "/login/verificar", "tras activarla, el siguiente login ya pide el código");
await B.poner("input[name=codigo]", await codigoFresco(secreto));
await B.clic("Verificar");
await B.esperarRuta(() => location.pathname === "/superadmin");
ok(B.ruta() === "/superadmin", "y con el código entra");

// ======================================================================= DUEÑO Y SIN SESIÓN
console.log("--- DUEÑO DE LOCAL Y VISITANTE ---");
const O = await sesion();
await O.contraseña(env.OWN_CORREO, env.OWN_CLAVE);
ok(O.ruta() === "/admin", `el dueño NO pasa por el segundo factor (${O.ruta()})`);
for (const r of ["/login/verificar", "/superadmin/mfa", "/superadmin"]) { await O.ir(r); ok(O.ruta() === "/admin", `el dueño en ${r} vuelve a /admin`); }
await O.csp();
const V = await sesion();
for (const r of ["/login/verificar", "/superadmin/mfa", "/superadmin"]) { await V.ir(r); ok(V.ruta() === "/login", `sin sesión, ${r} lleva a /login`); }
await V.csp();

ok(violaciones.length === 0, `sin violaciones de la CSP en todo el recorrido (${violaciones.length})`);
for (const s of [A, B, O, V]) await s.contexto.close().catch(() => {});
await browser.disconnect();
console.log(`\n${res.filter(Boolean).length}/${res.length} pruebas correctas`);
process.exit(res.every(Boolean) ? 0 : 1);
