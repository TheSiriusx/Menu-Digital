// Fase 8: sección «Asistente de WhatsApp» (Configuración) y estado «listo» de los pedidos.
// Requiere: servidor en :3100, Firefox en :9222, usuarios de preparar.py y datos de sembrar_b.py.
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


const NV = (await sql("select id from public.negocios where slug='nueva-victoria'"))[0].id;
const cfg = async () => (await sql(`select * from public.agente_config where negocio_id='${NV}'`))[0];
const A = "section[aria-labelledby=asistente]";
const sec = (id) => `${A} [data-seccion-asistente=${id}]`;
const guardar = async (id, boton, tipo = "status") => {
  await clicBoton(sec(id), boton);
  await esperarRed();
  return mensaje(sec(id), tipo);
};
const sinValidar = (id) => page.$eval(`${sec(id)} form`, (f) => (f.noValidate = true));

console.log("--- ACCESO ---");
await ir("/login");
await poner("input[name=correo]", env.OWN_CORREO);
await poner("input[name=clave]", env.OWN_CLAVE);
await clicBoton("form", "Entrar");
await page.waitForFunction(() => location.pathname === "/admin", { timeout: 15000 }).catch(() => {});
await ir("/admin/configuracion");
ok(!!(await page.$(A)), "Configuración tiene la sección «Asistente de WhatsApp»");
ok((await page.$$eval(`${A} [data-seccion-asistente]`, (l) => l.map((x) => x.dataset.seccionAsistente).join())) === "horario,pagos,entregas,avisos,avanzado", "secciones: horario, pagos, entregas, avisos y más ajustes");

console.log("--- ENCENDER Y APAGAR ---");
const estado = () => page.$eval("[data-estado-asistente]", (e) => e.dataset.estadoAsistente);
ok((await estado()) === "encendido" && (await cfg()).agente_activo === true, "empieza atendiendo");
await clicBoton(A, "Apagar asistente");
await page.waitForFunction(() => document.querySelector("[data-estado-asistente]")?.dataset.estadoAsistente === "apagado", { timeout: 15000 }).catch(() => {});
ok((await estado()) === "apagado" && (await cfg()).agente_activo === false, "«Apagar asistente» lo apaga en la base");
await sql(`update public.agente_config set agente_activo = true, pausado_hasta = now() + interval '3 hours' where negocio_id='${NV}'`);
await ir("/admin/configuracion");
ok(/En pausa hasta/.test(await texto("[data-estado-asistente]")), `una pausa puesta desde WhatsApp se ve: «${await texto("[data-estado-asistente]")}»`);
await clicBoton(A, "Encender asistente");
await page.waitForFunction(() => document.querySelector("[data-estado-asistente]")?.dataset.estadoAsistente === "encendido", { timeout: 15000 }).catch(() => {});
let c = await cfg();
ok(c.agente_activo === true && c.pausado_hasta === null, "«Encender asistente» lo enciende y quita la pausa");

console.log("--- HORARIO ---");
await page.$eval(`${sec("horario")} input[name=cerrado_domingo]`, (e) => (e.checked = true));
await poner(`${sec("horario")} input[name=desde_martes]`, "06:00");
await poner(`${sec("horario")} input[name=hasta_martes]`, "12:00");
await poner(`${sec("horario")} input[name=desde2_martes]`, "14:00");
await poner(`${sec("horario")} input[name=hasta2_martes]`, "19:00");
await page.$eval(`${sec("horario")} input[name=acepta_fuera_horario]`, (e) => (e.checked = false));
let m = await guardar("horario", "Guardar horario");
c = await cfg();
ok(m === "Guardado." && JSON.stringify(c.horario.domingo) === "[]" && c.horario.martes.length === 2 && c.horario.martes[1].desde === "14:00" && c.acepta_fuera_horario === false, "domingo cerrado, martes con dos tramos y sin pedidos fuera de horario");
await poner(`${sec("horario")} input[name=desde_miercoles]`, "19:00");
await poner(`${sec("horario")} input[name=hasta_miercoles]`, "06:00");
m = await guardar("horario", "Guardar horario", "alert");
ok(/Miércoles/.test(m ?? "") && (await cfg()).horario.miercoles[0].desde === "06:00", `horario al revés: rechazado sin cambiar nada («${m}»)`);
await ir("/admin/configuracion");
await poner(`${sec("horario")} input[name=desde2_jueves]`, "10:00");
await poner(`${sec("horario")} input[name=hasta2_jueves]`, "12:00");
m = await guardar("horario", "Guardar horario", "alert");
ok(/segundo horario/.test(m ?? ""), `segundo tramo encimado con el primero: rechazado («${m}»)`);

console.log("--- PAGOS ---");
await ir("/admin/configuracion");
await poner(`${sec("pagos")} textarea[name=datos_pago]`, "Pago móvil: Banco X, 0412-0000000, V-1\nZelle: pagos@ejemplo.com");
await page.$eval(`${sec("pagos")} input[value=al_confirmar]`, (e) => (e.checked = true));
m = await guardar("pagos", "Guardar pagos");
c = await cfg();
ok(m === "Guardado." && c.datos_pago === "Pago móvil: Banco X, 0412-0000000, V-1\nZelle: pagos@ejemplo.com" && c.pago_momento === "al_confirmar", "datos de pago en varias líneas y «cuando tú confirmas»");
await poner(`${sec("pagos")} textarea[name=datos_pago]`, "x".repeat(601));
await page.$eval(`${sec("pagos")} textarea[name=datos_pago]`, (e) => e.removeAttribute("maxlength"));
m = await guardar("pagos", "Guardar pagos", "alert");
ok(/600/.test(m ?? ""), `texto demasiado largo: rechazado en el servidor («${m}»)`);

console.log("--- ENTREGAS ---");
await ir("/admin/configuracion");
const modoAntes = (await cfg()).delivery_modo;
await page.$eval(`${sec("entregas")} select[name=delivery_modo]`, (e) => (e.value = "tarifa"));
await poner(`${sec("entregas")} input[name=delivery_tarifa_usd]`, "");
m = await guardar("entregas", "Guardar entregas", "alert");
ok(/tarifa/.test(m ?? "") && (await cfg()).delivery_modo === modoAntes, `tarifa fija sin monto: rechazada («${m}»)`);
await poner(`${sec("entregas")} input[name=delivery_tarifa_usd]`, "2,5");
await poner(`${sec("entregas")} textarea[name=delivery_texto]`, "Solo zona centro");
m = await guardar("entregas", "Guardar entregas");
c = await cfg();
ok(m === "Guardado." && c.delivery_modo === "tarifa" && Number(c.delivery_tarifa_usd) === 2.5 && c.delivery_texto === "Solo zona centro", "delivery con tarifa de $2,50 y condiciones");

console.log("--- AVISOS ---");
await ir("/admin/configuracion");
await poner(`${sec("avisos")} input[name=telefono_dueno]`, "0412-1234567");
await poner(`${sec("avisos")} input[name=recordatorio_1_min]`, "15");
await poner(`${sec("avisos")} input[name=recordatorio_2_min]`, "10");
m = await guardar("avisos", "Guardar avisos", "alert");
ok(/segundo recordatorio/.test(m ?? ""), `segundo recordatorio antes que el primero: rechazado («${m}»)`);
await poner(`${sec("avisos")} input[name=recordatorio_2_min]`, "45");
await poner(`${sec("avisos")} input[name=resena_url]`, "javascript:alert(1)");
await sinValidar("avisos");
m = await guardar("avisos", "Guardar avisos", "alert");
ok(/https/.test(m ?? "") && (await cfg()).resena_url === null, `enlace de reseña javascript: rechazado en el servidor («${m}»)`);
await poner(`${sec("avisos")} input[name=resena_url]`, "https://g.page/r/panaderia-prueba");
await page.$eval(`${sec("avisos")} select[name=resena_espera_min]`, (e) => (e.value = "180"));
m = await guardar("avisos", "Guardar avisos");
c = await cfg();
ok(m === "Guardado." && c.telefono_dueno === "584121234567" && c.recordatorio_1_min === 15 && c.recordatorio_2_min === 45 && c.resena_url === "https://g.page/r/panaderia-prueba" && c.resena_espera_min === 180, "teléfono normalizado, recordatorios 15/45, reseña a las 3 horas");
await ir("/admin/configuracion");
await poner(`${sec("avisos")} input[name=recordatorio_1_min]`, "");
await poner(`${sec("avisos")} input[name=recordatorio_2_min]`, "");
m = await guardar("avisos", "Guardar avisos");
c = await cfg();
ok(m === "Guardado." && c.recordatorio_1_min === null && c.recordatorio_2_min === null, "recordatorios vacíos = desactivados");

console.log("--- MÁS AJUSTES ---");
await ir("/admin/configuracion");
await poner(`${sec("avanzado")} input[name=stock_aviso_umbral]`, "200");
m = await guardar("avanzado", "Guardar", "alert");
ok(/entre 0 y 100/.test(m ?? ""), `umbral fuera de rango: rechazado («${m}»)`);
await poner(`${sec("avanzado")} input[name=stock_aviso_umbral]`, "3");
await poner(`${sec("avanzado")} input[name=encargo_aviso_horas]`, "24");
await poner(`${sec("avanzado")} input[name=pedido_grande_usd]`, "80");
await poner(`${sec("avanzado")} input[name=pedido_grande_unidades]`, "40");
m = await guardar("avanzado", "Guardar");
c = await cfg();
ok(m === "Guardado." && c.stock_aviso_umbral === 3 && c.encargo_aviso_horas === 24 && Number(c.pedido_grande_usd) === 80 && c.pedido_grande_unidades === 40, "umbral 3, encargos con 24 h, pedido grande desde $80 o 40 unidades");
await ir("/admin/configuracion");
ok((await page.$eval(`${sec("avanzado")} input[name=pedido_grande_usd]`, (e) => e.value)) === "80,00" && (await page.$eval(`${sec("pagos")} textarea`, (e) => e.value)).includes("\n"), "al volver, el formulario muestra lo guardado");

console.log("--- LOCAL PAUSADO ---");
await sql(`update public.negocios set activo = false where id='${NV}'`);
await ir("/admin/configuracion");
ok(await page.$eval(`${A} fieldset`, (f) => f.disabled), "pausado: la sección queda en solo lectura");
await page.$eval(`${A} fieldset`, (f) => (f.disabled = false));
m = await guardar("avanzado", "Guardar", "alert");
ok(!!m && (await cfg()).stock_aviso_umbral === 3, `forzando el botón, la base de datos lo rechaza («${m}»)`);
await sql(`update public.negocios set activo = true where id='${NV}'`);

console.log("--- ESTADO «LISTO» ---");
const P = (await sql(`select id from public.pedidos where negocio_id='${NV}' and estado='confirmado' limit 1`))[0].id;
await ir("/admin/pedidos");
const LI = `li[data-pedido="${P}"]`;
await page.$eval(`${LI} summary`, (x) => x.click());
const botones = await page.$$eval(`${LI} form button`, (b) => b.map((x) => x.textContent.trim()));
ok(botones.includes("Marcar listo"), `un pedido confirmado ofrece «Marcar listo» (${botones.join(", ")})`);
await clicBoton(LI, "Marcar listo");
await page.waitForFunction((s) => document.querySelector(s)?.dataset.estado === "listo", { timeout: 20000 }, LI).catch(() => {});
ok((await sql(`select estado from public.pedidos where id='${P}'`))[0].estado === "listo", "«Marcar listo» -> listo en la base");
ok((await texto(`${LI} summary`)).includes("Listo"), "la etiqueta dice «Listo»");
ok((await sql(`select count(*)::int n from public.agente_avisos where pedido_id='${P}' and clave='estado:listo' and anulado_en is null`))[0].n === 1, "queda en cola el aviso al cliente «tu pedido está listo»");
await page.$eval(`${LI} details`, (d) => (d.open = true));
const despues = await page.$$eval(`${LI} form button, ${LI} summary`, (b) => b.map((x) => x.textContent.trim()));
ok(despues.includes("Marcar pagado") && despues.includes("Marcar entregado"), "desde «listo»: pagado (paga al retirar) o entregado");
await ir("/admin?top=30");
ok((await texto("main")).includes("listos"), "el dashboard dice que «listo» cuenta como venta");

console.log("--- DISEÑO ---");
for (const [ancho, nombre] of [[1280, "pc"], [390, "cel"]]) {
  await page.setViewport({ width: ancho, height: 900 });
  await ir("/admin/configuracion");
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(desborde <= 1, `${nombre}: Configuración sin desplazamiento horizontal (${desborde}px)`);
  await page.$eval(A, (e) => e.scrollIntoView());
  await page.screenshot({ path: `${RAIZ}shots/asistente-${nombre}.png`, fullPage: true });
}

ok(errores.length === 0, `sin errores de consola ni de CSP (${errores.length})`);
if (errores.length) errores.slice(0, 6).forEach((e) => console.log("   ", e.slice(0, 300)));
console.log(`\n${res.filter(Boolean).length} de ${res.length} pruebas correctas`);
await contexto.close();
await browser.disconnect?.();
process.exit(res.every(Boolean) ? 0 : 1);
