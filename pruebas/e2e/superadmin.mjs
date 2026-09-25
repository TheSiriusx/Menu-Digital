import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
import { marcarUsado, pasoCodigo } from "./comun.mjs";

const BASE = "http://localhost:3100";
const env = Object.fromEntries(readFileSync(new URL("../e2e4.env", import.meta.url), "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const SLUG = "local-e2e-prueba";
marcarUsado(env.SA_TOTP_USADO);

const res = [];
const ok = (c, m) => { res.push(!!c); console.log((c ? "OK    " : "FALLA ") + m); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms * 3)); // la red hacia Supabase va lenta desde aquí

const browser = await puppeteer.connect({
  browserWSEndpoint: "ws://127.0.0.1:9222/session",
  protocol: "webDriverBiDi",
  defaultViewport: { width: 390, height: 900 },
});
const errores = [];
async function nuevaSesion() {
  const contexto = await browser.createBrowserContext();
  const page = await contexto.newPage();
  page.on("pageerror", (e) => errores.push(String(e)));
  page.on("console", async (m) => {
    if (m.type() !== "error") return;
    const partes = await Promise.all(m.args().map((a) => a.evaluate((x) => (x instanceof Error ? (x.stack || x.message) : String(x))).catch(() => m.text())));
    errores.push(`[${page.url()}] ` + (partes.join(" ") || m.text()));
  });
  return { contexto, page };
}

const ayudantes = (page) => {
  const ir = (ruta) => page.goto(BASE + ruta, { waitUntil: "networkidle0" });
  const ruta = () => new URL(page.url()).pathname;
  const poner = (sel, v) => page.$eval(sel, (el, x) => { el.value = x; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
  const clic = (raiz, texto) => page.evaluate((r, t) => {
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
  const login = async (correo, clave, secreto) => {
    await ir("/login");
    await poner("input[name=correo]", correo);
    await poner("input[name=clave]", clave);
    await clic("form", "Entrar");
    await page.waitForFunction(() => location.pathname !== "/login", { timeout: 10000 }).catch(() => {});
    await page.waitForNetworkIdle?.({ idleTime: 500, timeout: 8000 }).catch(() => {});
    await pasoCodigo(page, secreto);
  };
  return { ir, ruta, poner, clic, abrir, mensaje, login };
};

const publico = async (slug) => (await (await fetch(`${BASE}/${slug}`, { cache: "no-store" })).text()).replace(/<!-- -->/g, "");
const txt = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const LI = `li[data-local="${SLUG}"]`;

// ======================================================================= SUPER ADMIN
const A = await nuevaSesion();
const a = ayudantes(A.page);
console.log("--- ACCESO Y PROTECCIÓN ---");
await a.ir("/superadmin");
ok(a.ruta() === "/login", "sin sesión, /superadmin lleva a /login");
await a.login(env.SA_CORREO, env.SA_CLAVE, env.SA_TOTP);
ok(a.ruta() === "/superadmin", `login del super admin aterriza en /superadmin (${a.ruta()})`);
await a.ir("/admin");
ok(a.ruta() === "/superadmin", "el super admin en /admin es enviado a /superadmin");

console.log("--- LISTA DE LOCALES ---");
await a.ir("/superadmin");
let t = txt(await A.page.content());
ok(t.includes("Panadería Nueva Victoria") && t.includes("/nueva-victoria") && t.includes("16 productos"), "lista Nueva Victoria con enlace y 16 productos");
ok(t.includes(env.OWN_CORREO), "muestra los correos de sus dueños");

console.log("--- CREAR LOCAL ---");
const nuevo = "section[aria-labelledby=nuevo]";
await a.abrir(nuevo, "Nuevo local");
await a.poner(`${nuevo} input[name=nombre]`, "Local E2E Prueba");
await a.clic(nuevo, "Crear local");
let m = await a.mensaje(nuevo, "status");
ok(m && m.includes(`/${SLUG}`), `slug generado del nombre: "${m}"`);
await a.ir("/superadmin");
ok(!!(await A.page.$(LI)), "el local nuevo aparece en la lista");
ok((await A.page.$eval(`${LI} [data-estado]`, (e) => e.textContent)) === "Activo", "y nace Activo");

await a.abrir(nuevo, "Nuevo local");
await a.poner(`${nuevo} input[name=nombre]`, "Local E2E Prueba");
await a.clic(nuevo, "Crear local");
m = await a.mensaje(nuevo, "alert");
ok(m === "Ese enlace ya está en uso por otro local.", `slug repetido: "${m}"`);
await a.ir("/superadmin");
await a.abrir(nuevo, "Nuevo local");
await a.poner(`${nuevo} input[name=nombre]`, "Otro");
await a.poner(`${nuevo} input[name=slug]`, "admin");
await a.clic(nuevo, "Crear local");
m = await a.mensaje(nuevo, "alert");
ok(m && m.includes("reservado"), `slug reservado (admin): "${m}"`);
await a.ir("/superadmin");
await a.abrir(nuevo, "Nuevo local");
await a.poner(`${nuevo} input[name=nombre]`, "Otro");
await a.poner(`${nuevo} input[name=slug]`, "Mal Slug!");
await a.clic(nuevo, "Crear local");
m = await a.mensaje(nuevo, "alert");
ok(m && m.includes("minúsculas"), `slug con formato inválido: "${m}"`);

console.log("--- VINCULAR DUEÑO ---");
await a.ir("/superadmin");
await a.abrir(LI, "Estado, plan y dueño");
await a.poner(`${LI} input[type=email]`, "nadie-existe@starcklabs.test");
await a.clic(LI, "Vincular dueño");
m = await a.mensaje(LI, "alert");
ok(m && m.includes("No existe una cuenta"), `correo inexistente: "${m}"`);
await a.ir("/superadmin");
await a.abrir(LI, "Estado, plan y dueño");
await a.poner(`${LI} input[type=email]`, env.SA_CORREO);
await a.clic(LI, "Vincular dueño");
m = await a.mensaje(LI, "alert");
ok(m && m.includes("super admin"), `vincular a un super admin: "${m}"`);
await a.ir("/superadmin");
await a.abrir(LI, "Estado, plan y dueño");
await a.poner(`${LI} input[type=email]`, env.OWN2_CORREO.toUpperCase());
await a.clic(LI, "Vincular dueño");
m = await a.mensaje(LI, "status");
ok(m && m.includes("ahora es dueño"), `vincular dueño válido (correo en mayúsculas): "${m}"`);
await a.ir("/superadmin");
ok((await A.page.$eval(LI, (e) => e.textContent)).includes(env.OWN2_CORREO), "la lista muestra al dueño vinculado");

console.log("--- ARMAR EL MENÚ DEL LOCAL (como super admin) ---");
await a.ir(`/superadmin/locales/${SLUG}`);
ok((await A.page.content()).includes("Administrando:") && (await A.page.content()).includes("Local E2E Prueba"), "aviso 'Administrando: Local E2E Prueba'");
await a.ir(`/superadmin/locales/${SLUG}/categorias`);
await a.poner("section[aria-labelledby=nueva] input[name=nombre]", "Cat E2E");
await a.clic("section[aria-labelledby=nueva]", "Agregar");
ok((await a.mensaje("section[aria-labelledby=nueva]", "status")) === "Categoría creada.", "categoría creada en el local");
await a.ir(`/superadmin/locales/${SLUG}/menu`);
await a.abrir("section[aria-labelledby=nuevo]", "Agregar producto");
await a.poner("section[aria-labelledby=nuevo] input[name=nombre]", "Prod E2E");
await a.poner("section[aria-labelledby=nuevo] input[name=precio]", "1");
await A.page.$eval("section[aria-labelledby=nuevo] select[name=categoria]", (s) => { s.value = [...s.options].find((o) => o.textContent === "Cat E2E").value; });
await a.clic("section[aria-labelledby=nuevo]", "Agregar");
ok((await a.mensaje("section[aria-labelledby=nuevo]", "status")) === "Producto agregado.", "producto agregado al local");
let h = await publico(SLUG);
ok(txt(h).includes("Prod E2E") && txt(h).includes("Cat E2E"), "el menú público del local nuevo ya lo muestra");
ok(!(await publico("nueva-victoria")).includes("Prod E2E"), "y NO aparece en Nueva Victoria");

console.log("--- PLAN ---");
await a.ir("/superadmin");
await a.abrir(LI, "Estado, plan y dueño");
await A.page.$eval(`${LI} select[name=plan]`, (s) => { s.value = "pro"; });
await a.clic(LI, "Guardar plan");
ok((await a.mensaje(LI, "status")) === "Plan actualizado.", "plan cambiado a Pro");
await a.ir("/superadmin");
ok((await A.page.$eval(LI, (e) => e.textContent)).includes("Pro"), "la lista muestra el plan Pro");

// ======================================================================= DUEÑO 2 (del local nuevo)
const B = await nuevaSesion();
const b = ayudantes(B.page);
await b.login(env.OWN2_CORREO, env.OWN2_CLAVE);
console.log("--- DUEÑO DEL LOCAL NUEVO ---");
ok(b.ruta() === "/admin", "el dueño vinculado entra a /admin");
await b.ir("/admin/menu");
ok((await B.page.content()).includes("Prod E2E"), "ve el menú que armó el super admin");
await b.ir("/admin/configuracion");
ok(!(await B.page.$eval("input[name=tasa]", (i) => i.matches(":disabled"))), "local activo: los campos están habilitados");
for (const p of ["/superadmin", `/superadmin/locales/${SLUG}`, "/superadmin/cuenta"]) {
  await b.ir(p);
  ok(b.ruta() === "/admin", `el dueño no entra a ${p} (lo llevan a /admin)`);
}

console.log("--- PAUSAR (impago) ---");
await a.ir("/superadmin");
await a.abrir(LI, "Estado, plan y dueño");
await a.abrir(LI, "Pausar local");
await a.clic(LI, "Sí, pausar");
await dormir(1500);
await a.ir("/superadmin");
ok((await A.page.$eval(`${LI} [data-estado]`, (e) => e.textContent)) === "Pausado", "el local aparece Pausado");
h = await publico(SLUG);
ok(txt(h).includes("Menú temporalmente no disponible") && !txt(h).includes("Prod E2E"), "el menú público muestra el aviso de pausado AL INSTANTE y oculta el catálogo");
ok((await publico("nueva-victoria")).includes("Pan canilla"), "Nueva Victoria sigue activa");

await b.ir("/admin/configuracion");
ok((await B.page.content()).includes("Tu menú está pausado"), "el dueño ve el aviso de menú pausado");
ok(await B.page.$eval("input[name=tasa]", (i) => i.matches(":disabled")), "campos deshabilitados (tasa)");
await b.ir("/admin/menu");
ok(await B.page.$$eval("section[aria-labelledby=lista] button", (bs) => bs.length > 0 && bs.every((x) => x.matches(":disabled"))), "todos los botones del catálogo deshabilitados");
ok((await B.page.content()).includes("Prod E2E"), "pero puede ver su catálogo (solo lectura)");
await b.ir("/admin/ajustes");
ok(!(await B.page.$eval("section[aria-labelledby=clave] input[name=clave]", (i) => i.matches(":disabled"))), "cambiar contraseña sigue habilitado");

// El dueño se salta la pantalla (habilita el campo a la fuerza) y la base de datos lo bloquea.
await b.ir("/admin/configuracion");
await B.page.evaluate(() => { document.querySelector("fieldset").disabled = false; });
await b.poner("section[aria-labelledby=tasa] input[name=tasa]", "99");
await b.clic("section[aria-labelledby=tasa]", "Guardar tasa");
m = await b.mensaje("section[aria-labelledby=tasa]", "alert");
ok(m === "No se pudo guardar la tasa.", `saltándose la pantalla, la BASE DE DATOS lo rechaza: "${m}"`);

console.log("--- SUPER ADMIN EDITA UN LOCAL PAUSADO ---");
await a.ir(`/superadmin/locales/${SLUG}/configuracion`);
ok((await A.page.content()).includes("Este local está pausado"), "aviso al super admin: local pausado, puede editar");
ok(!(await A.page.$eval("input[name=tasa]", (i) => i.matches(":disabled"))), "sus campos NO están deshabilitados");
await a.poner("section[aria-labelledby=tasa] input[name=tasa]", "10");
await a.clic("section[aria-labelledby=tasa]", "Guardar tasa");
ok((await a.mensaje("section[aria-labelledby=tasa]", "status")) === "Tasa guardada.", "el super admin guarda la tasa del local pausado");

console.log("--- REACTIVAR ---");
await a.ir("/superadmin");
await a.abrir(LI, "Estado, plan y dueño");
await a.clic(LI, "Reactivar local");
await dormir(1500);
await a.ir("/superadmin");
ok((await A.page.$eval(`${LI} [data-estado]`, (e) => e.textContent)) === "Activo", "el local vuelve a Activo");
h = await publico(SLUG);
ok(txt(h).includes("Prod E2E") && txt(h).includes("Bs 10,00"), "el menú público vuelve, con la tasa que puso el super admin (Bs 10,00)");
await b.ir("/admin/configuracion");
ok(!(await B.page.$eval("input[name=tasa]", (i) => i.matches(":disabled"))), "el dueño recupera la edición");

// ======================================================================= MANIPULACIÓN
console.log("--- MANIPULACIÓN DEL CAMPO OCULTO ---");
// El dueño de Nueva Victoria intenta editar el precio de un producto del local nuevo cambiando el campo oculto.
const C = await nuevaSesion();
const c = ayudantes(C.page);
await c.login(env.OWN_CORREO, env.OWN_CLAVE);
ok(c.ruta() === "/admin", "el dueño de Nueva Victoria entra a su panel");
const ids = JSON.parse(JSON.stringify(await (async () => {
  // ids reales del local nuevo, leídos desde la vista del super admin
  await a.ir(`/superadmin/locales/${SLUG}/menu`);
  return A.page.evaluate(() => ({
    negocio: document.querySelector('input[name=negocio]').value,
    producto: document.querySelector('li[data-producto="Prod E2E"] input[name=id]').value,
  }));
})()));
await c.ir("/admin/menu");
await C.page.evaluate((ids) => {
  const li = [...document.querySelectorAll("li[data-producto]")][0];
  const f = li.querySelector('input[name=precio]').closest("form");
  f.querySelector('input[name=id]').value = ids.producto;          // producto del OTRO local
  f.querySelector('input[name=negocio]').value = ids.negocio;      // y su local, a mano
}, ids);
await c.poner('li[data-producto] input[name=precio]', "0,01");
await C.page.evaluate(() => [...document.querySelector("li[data-producto]").querySelectorAll("button")].find((x) => x.textContent.trim() === "Guardar").click());
m = await c.mensaje("li[data-producto]", "alert");
ok(m === "No se encontró el producto.", `editar un producto ajeno con el local manipulado: "${m}"`);
h = await publico(SLUG);
ok(txt(h).includes("$1,00") && !txt(h).includes("$0,01"), "el precio del producto ajeno NO cambió");

// Un dueño manda otro local en un alta de producto: se ignora y el producto cae en SU local.
await c.ir("/admin/menu");
await c.abrir("section[aria-labelledby=nuevo]", "Agregar producto");
await C.page.evaluate((ids) => { document.querySelector("section[aria-labelledby=nuevo] input[name=negocio]").value = ids.negocio; }, ids);
await c.poner("section[aria-labelledby=nuevo] input[name=nombre]", "Intruso E2E");
await c.poner("section[aria-labelledby=nuevo] input[name=precio]", "1");
await c.clic("section[aria-labelledby=nuevo]", "Agregar");
await c.mensaje("section[aria-labelledby=nuevo]", "status");
ok(!(await publico(SLUG)).includes("Intruso E2E"), "el alta con el local ajeno NO llegó al local ajeno");
ok((await publico("nueva-victoria")).includes("Intruso E2E"), "cayó en el local del propio dueño (se ignoró el campo)");

console.log("--- QUITAR DUEÑO ---");
await a.ir("/superadmin");
await a.abrir(LI, "Estado, plan y dueño");
await a.clic(LI, "Quitar");
await dormir(1500);
await a.ir("/superadmin");
ok(!(await A.page.$eval(LI, (e) => e.textContent)).includes(env.OWN2_CORREO), "el dueño ya no aparece vinculado");
await b.ir("/admin");
ok(b.ruta() === "/admin/sin-cuenta", `sin vínculo, el ex-dueño ve 'cuenta sin local' (${b.ruta()})`);

console.log("--- CIERRE ---");
await a.ir("/superadmin/cuenta");
ok((await A.page.content()).includes("Cambiar contraseña"), "el super admin tiene su pantalla de contraseña");
await A.page.evaluate(() => [...document.querySelectorAll("header button")].find((x) => x.textContent.trim() === "Salir").click());
await A.page.waitForFunction(() => location.pathname === "/login", { timeout: 8000 }).catch(() => {});
await a.ir("/superadmin");
ok(a.ruta() === "/login", "tras salir, /superadmin vuelve a pedir login");

const graves = errores.filter((e) => !/favicon|Failed to load resource/i.test(e));
ok(graves.length === 0, `sin errores de consola (${graves.length})`);
if (graves.length) console.log(graves.join("\n"));

for (const s of [A, B, C]) await s.contexto.close().catch(() => {});
await browser.disconnect();
console.log(`\n${res.filter(Boolean).length}/${res.length} pruebas correctas`);
process.exit(res.every(Boolean) ? 0 : 1);
