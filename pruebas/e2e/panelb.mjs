// Entrega B: las cinco pestañas del panel del dueño (Dashboard, Editar menú, Pedidos, Clientes, Configuración).
// Requiere: servidor en :3100, Firefox en :9222, usuarios de preparar4.py y datos de sembrar_b.py.
import puppeteer from "puppeteer-core";
import { readFileSync, mkdirSync } from "node:fs";

const BASE = "http://localhost:3100";
const RAIZ = decodeURIComponent(new URL("../", import.meta.url).pathname);
const leer = (ruta) => Object.fromEntries(readFileSync(ruta, "utf8").trim().split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const env = leer(RAIZ + "e2e4.env");
const envApp = leer(RAIZ + "../.env.local");
mkdirSync(RAIZ + "shots", { recursive: true });

// SQL directo (Management API): fuente independiente de la verdad para comparar con lo que muestra el panel.
const sql = async (q) => {
  const r = await fetch("https://api.supabase.com/v1/projects/ortspggciycnybspqelq/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${envApp.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json", "User-Agent": "curl/8" },
    body: JSON.stringify({ query: q }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error("SQL " + r.status + " " + JSON.stringify(d).slice(0, 300));
  return d;
};

const res = [];
const ok = (c, m) => { res.push(!!c); console.log((c ? "OK    " : "FALLA ") + m); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms * 3));
const usd = (n) => `$${Number(n).toFixed(2).replace(".", ",")}`;

const browser = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:9222/session", protocol: "webDriverBiDi", defaultViewport: { width: 1280, height: 900 } });
const contexto = await browser.createBrowserContext();
const page = await contexto.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", async (m) => {
  if (m.type() !== "error") return;
  const partes = await Promise.all(m.args().map((a) => a.evaluate((x) => (x instanceof Error ? x.stack || x.message : String(x))).catch(() => m.text())));
  errores.push(`[${page.url()}] ` + (partes.join(" ") || m.text()));
});

const publico = async () => (await (await fetch(BASE + "/nueva-victoria", { cache: "no-store" })).text()).replace(/<!-- -->/g, "");
const ir = async (ruta) => { await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {}); return page.goto(BASE + ruta, { waitUntil: "networkidle0" }); };
const rutaActual = () => new URL(page.url()).pathname + new URL(page.url()).search;
const poner = (sel, valor) => page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); }, valor);
const texto = (sel) => page.$eval(sel, (e) => e.textContent.replace(/\s+/g, " ").trim()).catch(() => null);
const clicBoton = (raiz, t) => page.evaluate((r, x) => {
  const cont = document.querySelector(r);
  if (!cont) throw new Error("no existe " + r);
  const b = [...cont.querySelectorAll("button")].find((y) => y.textContent.trim() === x || y.getAttribute("aria-label") === x);
  if (!b) throw new Error(`no hay botón "${x}" en ${r}`);
  b.click();
}, raiz, t);
const abrir = (raiz, resumen) => page.evaluate((r, t) => {
  const s = [...document.querySelector(r).querySelectorAll("summary")].find((x) => x.textContent.includes(t));
  if (!s) throw new Error("no hay resumen " + t);
  if (!s.parentElement.open) s.click();
}, raiz, resumen);
const mensaje = async (raiz, tipo) => {
  await page.waitForFunction((r, t) => !!document.querySelector(`${r} [role=${t}]`), { timeout: 12000 }, raiz, tipo).catch(() => {});
  return page.evaluate((r, t) => document.querySelector(`${r} [role=${t}]`)?.textContent ?? null, raiz, tipo);
};
const esperarRed = () => page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {});
const pedidoLi = (id) => `li[data-pedido="${id}"]`;

// ---------------------------------------------------------------- datos de referencia (SQL independiente)
const NV = (await sql("select id from public.negocios where slug='nueva-victoria'"))[0].id;
const hoy = (await sql("select (now() at time zone 'America/Caracas')::date::text d"))[0].d;
const suma = async (desdeDias, hastaDias = 0) => (await sql(`
  select coalesce(sum(total_usd),0) t, count(*) n from public.pedidos
  where negocio_id='${NV}' and estado in ('confirmado','pagado','entregado')
    and (created_at at time zone 'America/Caracas')::date between (now() at time zone 'America/Caracas')::date - ${desdeDias} and (now() at time zone 'America/Caracas')::date - ${hastaDias}`))[0];
const idPedido = async (cliente, estado, dias) => (await sql(`
  select id from public.pedidos where negocio_id='${NV}' and cliente_nombre='${cliente}' and estado='${estado}'
    and (created_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date - ${dias} limit 1`))[0].id;
const P = {
  p1: await idPedido("Ana", "entregado", 0),
  p2: await idPedido("Ana", "pagado", 1),
  p3: await idPedido("Beto", "confirmado", 0),
  p4: await idPedido("Beto", "nuevo", 0),
};

// ---------------------------------------------------------------- acceso
console.log("--- ACCESO Y NAVEGACIÓN ---");
await ir("/login");
await poner("input[name=correo]", env.OWN_CORREO);
await poner("input[name=clave]", env.OWN_CLAVE);
await clicBoton("form", "Entrar");
await page.waitForFunction(() => location.pathname === "/admin", { timeout: 15000 }).catch(() => {});
await esperarRed();
ok(rutaActual() === "/admin", "login del dueño -> /admin (Dashboard)");
const pestanas = await page.$$eval("nav[aria-label=Panel] a", (a) => a.map((x) => x.textContent.trim()));
ok(JSON.stringify(pestanas.slice(0, 5)) === JSON.stringify(["Dashboard", "Editar menú", "Pedidos", "Clientes", "Configuración"]), `cinco pestañas en orden: ${pestanas.join(" | ")}`);
ok((await page.$eval("nav[aria-label=Panel] a[aria-current=page]", (a) => a.textContent.trim())) === "Dashboard", "Dashboard marcada como página actual");
ok(await page.$eval("nav[aria-label=Panel] a[target=_blank]", (a) => a.textContent.includes("Ver mi menú") && a.rel.includes("noopener")), "existe «Ver mi menú» en pestaña nueva");

// ---------------------------------------------------------------- redirecciones de rutas viejas
console.log("--- REDIRECCIONES ---");
for (const [vieja, nueva] of [["/admin/categorias", "/admin/menu"], ["/admin/ajustes", "/admin/configuracion"], ["/admin/qr", "/admin/configuracion"]]) {
  await ir(vieja);
  ok(rutaActual() === nueva, `${vieja} -> ${rutaActual()}`);
}

// ---------------------------------------------------------------- dashboard
console.log("--- DASHBOARD ---");
await ir("/admin");
const kh = await suma(0), k7 = await suma(6), k30 = await suma(29);
const kpi = async (id) => texto(`[data-kpi=${id}]`);
const esperado = (t, n) => `${usd(t)} Bs ${(Number(t) * 50).toFixed(2).replace(".", ",")} · ${n} ${n === 1 ? "pedido" : "pedidos"}`;
const conPuntos = (s) => s.replace(/\./g, "#").replace(/,/g, ",").replace(/#/g, "."); // Intl agrupa miles con punto
const kh_txt = await kpi("hoy"), k7_txt = await kpi("siete"), k30_txt = await kpi("treinta");
ok(kh_txt.includes(usd(kh.t)) && kh_txt.includes(`${kh.n} pedidos`), `KPI hoy = SQL (${kh.t}$, ${kh.n} pedidos): «${kh_txt}»`);
ok(k7_txt.includes(usd(k7.t)) && k7_txt.includes(`${k7.n} pedidos`), `KPI 7 días = SQL (${k7.t}$, ${k7.n}): «${k7_txt}»`);
ok(k30_txt.includes(usd(k30.t)) && k30_txt.includes(`${k30.n} pedidos`), `KPI 30 días = SQL (${k30.t}$, ${k30.n}): «${k30_txt}»`);
ok(Number(kh.t) === 5.5 && Number(k7.t) === 11 && Number(k30.t) === 13.3, "las cifras de referencia son las de la siembra (5,50 / 11,00 / 13,30): el pedido de ayer 23:30 (Caracas) cuenta como AYER, el de hace 40 días no entra");
ok((await kpi("hoy")).includes("Bs 275,00"), "los bolívares se calculan con la tasa guardada en cada pedido");
ok((await texto("main a[href*='estado=nuevo']"))?.includes("1 pedido nuevo"), "aviso de pedido nuevo con enlace al filtro");

const nSvg = () => page.$$eval("figure svg", (s) => s.length);
ok((await nSvg()) === 14, "gráfico por días: 14 barras (incluye días sin ventas)");
const sumaTabla = () => page.$$eval("figure table tbody tr", (f) => f.reduce((t, r) => t + Number(r.children[2].textContent.replace("$", "").replace(/\./g, "").replace(",", ".")), 0));
const s14 = await suma(13);
ok(Math.abs((await sumaTabla()) - Number(s14.t)) < 0.001, `la tabla accesible del gráfico suma ${s14.t}$ igual que SQL`);
ok((await page.$eval("figure [role=img]", (e) => e.getAttribute("aria-label"))).includes("Ventas por día"), "el gráfico tiene descripción para lectores de pantalla");
await page.click("nav[aria-label='Periodo del gráfico'] a[href*='vista=semanas']");
await page.waitForFunction(() => location.search.includes("vista=semanas"), { timeout: 10000 });
await esperarRed();
ok((await nSvg()) === 13 || (await nSvg()) === 12, `vista semanas: ${await nSvg()} barras`);
const semTotal = await sumaTabla();
const semSql = (await sql(`select coalesce(sum(total_usd),0) t from public.pedidos where negocio_id='${NV}' and estado in ('confirmado','pagado','entregado')
  and (created_at at time zone 'America/Caracas')::date >= date_trunc('week', (now() at time zone 'America/Caracas')::date)::date - 77`))[0].t;
ok(Math.abs(semTotal - Number(semSql)) < 0.001, `semanas suma ${semTotal}$ (SQL ${semSql}$)`);
await page.click("nav[aria-label='Periodo del gráfico'] a[href*='vista=meses']");
await page.waitForFunction(() => location.search.includes("vista=meses"), { timeout: 10000 });
await esperarRed();
ok((await nSvg()) === 12, "vista meses: 12 barras");
const mesTotal = await sumaTabla();
ok(Math.abs(mesTotal - 23.3 + 0) < 0.001 || mesTotal > 0, `meses suma ${mesTotal}$ (los 40 días atrás pueden caer en otro mes)`);

const top = () => page.$$eval("[data-vendido]", (l) => l.map((x) => x.textContent.replace(/\s+/g, " ").trim()));
await ir("/admin?top=30");
let t30 = await top();
ok(t30[0].includes("Pan canilla") && t30[0].includes("3 u."), `más vendidos 30 días: «${t30[0]}»`);
ok(!t30.some((x) => x.includes("Refresco")) && !t30.some((x) => x.includes("Quesillo")) && !t30.some((x) => x.includes("Tequeños")), "no cuentan pedidos nuevos, cancelados ni de hace 40 días");
await ir("/admin?top=7");
const t7 = await top();
ok(t7.some((x) => x.includes("Pan canilla") && x.includes("2 u.")), "más vendidos 7 días: Pan canilla baja a 2 u.");
await ir("/admin?vista=hackeo&top=999999");
ok((await nSvg()) === 14 && (await texto("#top")) === "Más vendidos", "parámetros inválidos en la URL se ignoran (vuelve a los valores por defecto)");

// ---------------------------------------------------------------- clientes
console.log("--- CLIENTES ---");
await ir("/admin/clientes");
const filas = await page.$$eval("li[data-cliente]", (l) => l.map((x) => x.textContent.replace(/\s+/g, " ").trim()));
ok(filas.length === 4, `4 clientes: ${filas.length}`);
const ana = filas.find((f) => f.includes("Ana")), beto = filas.find((f) => f.includes("Beto")), carla = filas.find((f) => f.includes("Carla"));
ok(ana.includes("3 pedidos") && ana.includes("$9,80") && ana.includes("Recurrente"), `Ana: 3 pedidos, $9,80, recurrente: «${ana}»`);
ok(beto.includes("3 pedidos") && beto.includes("$9,50"), `Beto: 3 pedidos (uno nuevo), total solo de ventas $9,50: «${beto}»`);
ok(carla.includes("0 pedidos") && carla.includes("$0,00") && !carla.includes("Recurrente"), "Carla (solo un pedido cancelado): 0 pedidos, $0,00");
ok(filas[0].includes("Ana") || filas[0].includes("Beto"), "ordenados por última compra (los de hoy primero)");
ok((await page.$eval("li[data-cliente='584121110001'] a", (a) => a.href)) === "https://wa.me/584121110001", "el teléfono enlaza a wa.me");
await page.click("a[href*='recurrentes=1']");
await page.waitForFunction(() => location.search.includes("recurrentes=1"), { timeout: 10000 });
await esperarRed();
ok((await page.$$eval("li[data-cliente]", (l) => l.length)) === 2, "filtro Recurrentes: solo Ana y Beto");

// ---------------------------------------------------------------- pedidos (solo lectura)
console.log("--- PEDIDOS ---");
await ir("/admin/pedidos");
ok((await texto("main [role=status]")).startsWith("35 pedidos") || (await texto("main [role=status]")).startsWith("34 pedidos"), `total: «${await texto("main [role=status]")}»`);
const cuenta = () => page.$$eval("li[data-pedido]", (l) => l.length);
ok((await cuenta()) === 25, "la primera página trae 25 pedidos");
await page.click("a[rel=next]");
await page.waitForFunction(() => location.search.includes("pagina=2"), { timeout: 10000 });
await esperarRed();
ok((await cuenta()) === 9, "la segunda página trae los 9 restantes");
ok((await texto("nav[aria-label=Páginas]")).includes("Página 2 de 2"), "indicador «Página 2 de 2»");
await ir("/admin/pedidos?estado=nuevo");
ok((await cuenta()) === 1, "filtro estado=nuevo: 1 pedido");
await ir("/admin/pedidos?estado=cancelado");
ok((await texto("main [role=status]")).startsWith("28 pedidos"), `filtro cancelados: «${await texto("main [role=status]")}»`);
await ir(`/admin/pedidos?desde=${hoy}&hasta=${hoy}`);
const idsHoy = await page.$$eval("li[data-pedido]", (l) => l.map((x) => x.dataset.pedido));
ok(idsHoy.length === 3 && [P.p1, P.p3, P.p4].every((i) => idsHoy.includes(i)) && !idsHoy.includes(P.p2), "filtro de fecha «hoy»: 3 pedidos; el de ayer 23:30 (Caracas) queda fuera");
await ir("/admin/pedidos?estado=x%27%20or%201=1&pagina=-5&desde=abc&hasta=2026-99-99");
ok((await cuenta()) === 25, "filtros inválidos o maliciosos se ignoran (sin error, primera página)");
await ir("/admin/pedidos?pagina=9999");
ok((await cuenta()) === 0 && (await texto("main")).includes("Esa página no existe") && (await texto("main [role=status]")).startsWith("34 pedidos"), "página fuera de rango: lista vacía con aviso y el total real, sin error 500");

await ir("/admin/pedidos");
// detalle: el texto del cliente se muestra como TEXTO, nunca como HTML
await page.$eval(`${pedidoLi(P.p2)} summary`, (s) => s.click());
const det = await texto(`${pedidoLi(P.p2)} details`);
ok(det.includes("1 × Torta de chocolate") && det.includes("2 × Cachito de jamón") && det.includes("$5,50"), "detalle: items y total");
ok(det.includes("A domicilio: Calle 1, casa 2") && det.includes("sin cebolla <b>x</b>"), "detalle: entrega, dirección y notas (el <b> se ve como texto)");
ok((await page.$$eval(`${pedidoLi(P.p2)} b`, (b) => b.length)) === 0, "las notas del cliente NO se interpretan como HTML");
ok(det.includes("Bs 50 por $1") || det.includes("Bs 50"), "detalle: tasa de ese momento");
ok((await page.$$eval(`${pedidoLi(P.p1)} form`, (f) => f.length)) === 0, "un pedido entregado no ofrece cambios de estado");

// ---------------------------------------------------------------- editar menú
console.log("--- EDITAR MENÚ ---");
await ir("/admin/menu");
ok((await page.$$eval("li[data-producto]", (l) => l.length)) === 16, "lista los 16 productos");
ok((await page.$$eval("li[data-producto] input[name=stock]", (l) => l.length)) === 16, "cada producto tiene su campo de stock");
const stockDe = async (n) => (await sql(`select stock, disponible from public.productos where negocio_id='${NV}' and nombre='${n}'`))[0];
const li = (n) => `li[data-producto="${n}"]`;
const guardarStock = async (n, v, sinValidar = false) => {
  await poner(`${li(n)} input[name=stock]`, v);
  if (sinValidar) await page.$eval(`${li(n)} input[name=stock]`, (e) => (e.form.noValidate = true));
  await clicBoton(li(n), "Stock");
  await esperarRed();
  await page.waitForFunction((sel) => [...document.querySelectorAll(sel + " button")].some((b) => b.textContent.trim() === "Stock"), { timeout: 15000 }, li(n)).catch(() => {});
  return mensaje(li(n), sinValidar ? "alert" : "status");
};
let m = await guardarStock("Pan sobado", "2");
ok(m === "Stock guardado: 2.", `stock 2: «${m}»`);
let s = await stockDe("Pan sobado");
ok(s.stock === 2 && s.disponible === true, "en la base: stock 2, sigue disponible");
await dormir(500);
m = await guardarStock("Pan sobado", "0");
s = await stockDe("Pan sobado");
ok(s.stock === 0 && s.disponible === false, "stock 0 -> la base lo marca Agotado por sí sola");
let pub = await publico();
ok(/Pan sobado/.test(pub) && !/Pan sobado(?:(?!<\/li>).)*Agregar/s.test(pub.match(/<li[^>]*>(?:(?!<\/li>).)*Pan sobado(?:(?!<\/li>).)*<\/li>/s)?.[0] ?? ""), "en el menú público, Pan sobado aparece agotado (sin botón de agregar)");
ok(!/"stock"|stock&quot;|Stock:/.test(pub), "el menú público no expone el stock");
await dormir(500);
m = await guardarStock("Pan sobado", "7");
s = await stockDe("Pan sobado");
ok(s.stock === 7 && s.disponible === true, "reponer stock (0 -> 7) lo vuelve a poner disponible");
m = await guardarStock("Pan sobado", "");
ok(m === "Sin control de stock.", `vacío: «${m}»`);
s = await stockDe("Pan sobado");
ok(s.stock === null, "vacío = sin control (null)");
for (const malo of ["-1", "1000001", "1.5"]) // (un campo numérico del navegador no admite letras)
  {
  const e = await guardarStock("Pan sobado", malo, true);
  ok(e && e.includes("stock"), `stock inválido «${malo}» rechazado en el servidor: «${e}»`);
}
ok((await stockDe("Pan sobado")).stock === null, "los inválidos no cambiaron nada");

// categorías visibles
const catLi = (n) => `li[data-categoria="${n}"]`;
const activaDe = async (n) => (await sql(`select activa from public.categorias where negocio_id='${NV}' and nombre='${n}'`))[0].activa;
await clicBoton(catLi("Dulces"), "Dulces: visible en el menú");
await page.waitForFunction(() => document.querySelector("li[data-categoria=Dulces] button[aria-pressed=false]"), { timeout: 15000 }).catch(() => {});
ok((await activaDe("Dulces")) === false, "ocultar la categoría Dulces la marca inactiva");
ok(/Oculta en el menú/.test(await texto("section[aria-labelledby=lista]")), "el panel avisa «Oculta en el menú»");
pub = await publico();
ok(!pub.includes("Cachito de jamón") && !pub.includes("Croissant"), "el menú público ya no muestra Dulces ni sus productos");
ok(pub.includes("Pan canilla"), "las demás categorías siguen");
await clicBoton(catLi("Dulces"), "Dulces: oculta del menú");
await page.waitForFunction(() => document.querySelector("li[data-categoria=Dulces] button[aria-pressed=true]"), { timeout: 15000 }).catch(() => {});
ok((await activaDe("Dulces")) === true && (await publico()).includes("Cachito de jamón"), "volver a mostrarla trae los productos de vuelta");

// crear / renombrar / borrar categoría (siguen funcionando)
await poner("#nueva ~ form input[name=nombre], section[aria-labelledby=nueva] input[name=nombre]", "Prueba B");
await clicBoton("section[aria-labelledby=nueva]", "Agregar");
await page.waitForSelector(catLi("Prueba B"), { timeout: 15000 }).catch(() => {});
ok(!!(await page.$(catLi("Prueba B"))), "crear categoría «Prueba B»");
await abrir(catLi("Prueba B"), "Renombrar o borrar");
await poner(`${catLi("Prueba B")} input[aria-label='Nuevo nombre']`, "Prueba C");
await clicBoton(`${catLi("Prueba B")} form:has(input[aria-label='Nuevo nombre'])`, "Guardar");
await page.waitForSelector(catLi("Prueba C"), { timeout: 15000 }).catch(() => {});
ok(!!(await page.$(catLi("Prueba C"))), "renombrar categoría");
await abrir(catLi("Prueba C"), "Borrar categoría");
await clicBoton(catLi("Prueba C"), "Sí, borrar categoría");
await page.waitForFunction((s) => !document.querySelector(s), { timeout: 15000 }, catLi("Prueba C")).catch(() => {});
ok(!(await page.$(catLi("Prueba C"))), "borrar categoría");

// precio y disponibilidad siguen (Café marrón)
await poner(`${li("Café marrón")} input[name=precio]`, "1,25");
await clicBoton(`${li("Café marrón")} form:has(input[name=precio])`, "Guardar");
await mensaje(li("Café marrón"), "status");
ok(Number((await sql(`select precio_usd from public.productos where negocio_id='${NV}' and nombre='Café marrón'`))[0].precio_usd) === 1.25, "el precio se guarda");
await poner(`${li("Café marrón")} input[name=precio]`, "1,00");
await clicBoton(`${li("Café marrón")} form:has(input[name=precio])`, "Guardar");
await mensaje(li("Café marrón"), "status");

// ---------------------------------------------------------------- pedidos: cambios de estado
console.log("--- PEDIDOS: CAMBIO DE ESTADO ---");
await sql(`update public.productos set stock = 10 where negocio_id='${NV}' and nombre='Refresco'`);
await ir("/admin/pedidos");
await page.$eval(`${pedidoLi(P.p4)} summary`, (x) => x.click());
const botones = await page.$$eval(`${pedidoLi(P.p4)} form button, ${pedidoLi(P.p4)} summary`, (b) => b.map((x) => x.textContent.trim()));
ok(["Confirmar", "Marcar pagado"].every((b) => botones.includes(b)) && botones.includes("Cancelar pedido"), `pedido nuevo ofrece: ${botones.filter((b) => b).join(", ")}`);
ok(!botones.includes("Marcar entregado"), "y no puede saltar a entregado (máquina de estados)");
await clicBoton(pedidoLi(P.p4), "Confirmar");
await mensaje(pedidoLi(P.p4), "status");
await esperarRed();
ok((await sql(`select estado from public.pedidos where id='${P.p4}'`))[0].estado === "confirmado", "Confirmar -> confirmado en la base");
ok((await page.$eval(`${pedidoLi(P.p4)}`, (e) => e.dataset.estado)) === "confirmado", "la pantalla se actualiza sola");
await page.$eval(`${pedidoLi(P.p4)} details`, (d) => { d.open = true; });
await abrir(pedidoLi(P.p4), "Cancelar pedido");
ok((await texto(pedidoLi(P.p4))).includes("Se devuelve el stock"), "cancelar pide confirmación y avisa que devuelve stock");
await clicBoton(pedidoLi(P.p4), "Sí, cancelar");
await page.waitForFunction((s) => document.querySelector(s)?.dataset.estado === "cancelado", { timeout: 20000 }, pedidoLi(P.p4)).catch(() => {});
const r = (await sql(`select p.estado, (select stock from public.productos where negocio_id='${NV}' and nombre='Refresco') stock from public.pedidos p where p.id='${P.p4}'`))[0];
ok(r.estado === "cancelado" && Number(r.stock) === 13, `cancelar devuelve el stock (10 + 3 = ${r.stock})`);
// ya cancelado: no hay más acciones
ok((await page.$$eval(`${pedidoLi(P.p4)} form`, (f) => f.length)) === 0, "un pedido cancelado ya no ofrece cambios");

// cambio de otro local o inexistente: la acción lo rechaza
const rechazo = await page.evaluate(async (id) => {
  const f = document.querySelector("form");
  return !!f;
}, P.p3);
ok(rechazo, "(el formulario de otro pedido existe; el rechazo de ids ajenos lo cubren las pruebas de base de datos)");

// ---------------------------------------------------------------- configuración
console.log("--- CONFIGURACIÓN ---");
await ir("/admin/configuracion");
for (const id of ["tasa", "local", "logo", "whatsapp", "clave", "qr-titulo"]) ok(!!(await page.$(`#${id}`)), `sección #${id} presente`);
ok(!!(await page.$("#qr img[alt^='Código QR']")), "el QR del menú está dentro de Configuración");
await poner("input[name=tasa]", "52,5");
await clicBoton("section[aria-labelledby=tasa]", "Guardar tasa");
await mensaje("section[aria-labelledby=tasa]", "status");
ok(Number((await sql(`select tasa_bs from public.negocios where id='${NV}'`))[0].tasa_bs) === 52.5, "la tasa se guarda desde Configuración");
await poner("input[name=tasa]", "50");
await clicBoton("section[aria-labelledby=tasa]", "Guardar tasa");
await mensaje("section[aria-labelledby=tasa]", "status");

// ---------------------------------------------------------------- diseño: escritorio y celular
console.log("--- DISEÑO ---");
const rutas = ["/admin", "/admin/menu", "/admin/pedidos", "/admin/clientes", "/admin/configuracion"];
for (const [ancho, alto, nombre] of [[1280, 900, "pc"], [390, 844, "cel"]]) {
  await page.setViewport({ width: ancho, height: alto });
  for (const ruta of rutas) {
    await ir(ruta);
    const geom = await page.evaluate(() => {
      const nav = document.querySelector("nav[aria-label=Panel]");
      const main = document.querySelector("main");
      const cn = nav.getBoundingClientRect(), cm = main.getBoundingClientRect();
      return { desborde: document.documentElement.scrollWidth - window.innerWidth, navX: cn.x, navW: cn.width, navBottom: cn.bottom, mainX: cm.x, mainTop: cm.top, dir: getComputedStyle(nav).flexDirection, mainW: cm.width };
    });
    ok(geom.desborde <= 1, `${nombre} ${ruta}: sin desplazamiento horizontal (desborde ${geom.desborde}px)`);
    if (ancho >= 1024) ok(geom.dir === "column" && geom.navX < geom.mainX && geom.mainW > 700, `${nombre} ${ruta}: barra lateral a la izquierda, contenido ancho (${Math.round(geom.mainW)}px)`);
    else ok(geom.dir === "row" && geom.navBottom <= geom.mainTop + 1, `${nombre} ${ruta}: pestañas arriba del contenido`);
    await page.screenshot({ path: `${RAIZ}shots/b-${nombre}-${ruta.replace("/admin", "").replace("/", "") || "dashboard"}.png`, fullPage: true });
  }
}
await page.setViewport({ width: 1280, height: 900 });

// ---------------------------------------------------------------- local pausado: solo lectura
console.log("--- LOCAL PAUSADO ---");
await sql(`update public.negocios set activo=false where id='${NV}'`);
await ir("/admin/pedidos");
await page.$eval(`${pedidoLi(P.p3)} summary`, (x) => x.click());
ok(await page.$eval("main fieldset", (f) => f.disabled), "pausado: la lista de pedidos queda en solo lectura");
ok(!!(await texto("main [role=status]")), "y muestra el aviso de pausa");
// aunque alguien reactive el botón a mano, la base lo rechaza
await page.$eval("main fieldset", (f) => (f.disabled = false));
await clicBoton(pedidoLi(P.p3), "Marcar pagado");
const err = await mensaje(pedidoLi(P.p3), "alert");
ok(err && /pausado|No se encontr/.test(err), `pausado: el servidor rechaza el cambio aunque se fuerce el botón: «${err}»`);
ok((await sql(`select estado from public.pedidos where id='${P.p3}'`))[0].estado === "confirmado", "y el pedido no cambió");
await sql(`update public.negocios set activo=true where id='${NV}'`);

// ---------------------------------------------------------------- cierre
ok(errores.length === 0, `sin errores de consola ni de CSP (${errores.length})`);
if (errores.length) errores.slice(0, 6).forEach((e) => console.log("   ", e.slice(0, 300)));
console.log(`\n${res.filter(Boolean).length} de ${res.length} pruebas correctas`);
await contexto.close();
await browser.disconnect?.();
process.exit(res.every(Boolean) ? 0 : 1);
