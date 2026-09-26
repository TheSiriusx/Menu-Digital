import puppeteer from "puppeteer-core";

import { execFileSync } from "node:child_process";
const BASE = "http://localhost:3100";
// Los datos reales del local (tasa y WhatsApp los cambia el dueño): la prueba los lee en vez de suponerlos.
const S = decodeURIComponent(new URL("..", import.meta.url).pathname);
const real = JSON.parse(execFileSync("python3", ["-c", "import sys,json;sys.path.insert(0,sys.argv[1]);from db import sql;print(json.dumps(sql(sys.argv[2])[0]))", S,
  "select tasa_bs::float8 as tasa, telefono_whatsapp as tel from public.negocios where slug = 'nueva-victoria'"]).toString());
const bs = (usd) => "Bs " + new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.round(Math.round(usd * 100) * real.tasa) / 100);
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const resultados = [];
const ok = (cond, msg) => { resultados.push(cond); console.log((cond ? "OK   " : "FALLA ") + msg); };

const browser = await puppeteer.connect({
  browserWSEndpoint: "ws://127.0.0.1:9222/session",
  protocol: "webDriverBiDi",
  defaultViewport: { width: 390, height: 800 },
});
const page = await browser.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
// Captura la URL de WhatsApp en vez de abrirla.
await page.evaluateOnNewDocument(() => {
  window.open = (u) => { window.__wa = u; return { opener: null }; };
});

const texto = (sel) => page.$eval(sel, (el) => el.textContent);
const barra = () => page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Ver pedido"));
  return b ? b.textContent.replace(/\s+/g, " ") : null;
});
const clic = (etiqueta) => page.evaluate((e) => {
  const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === e || x.textContent.trim() === e);
  if (!b) throw new Error("no hay botón " + e);
  b.click();
}, etiqueta);

await page.goto(`${BASE}/nueva-victoria`, { waitUntil: "networkidle0" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle0" });

ok((await barra()) === null, "sin productos en el carrito no hay barra de pedido");
const agregar = await page.$$eval("button", (bs) => bs.filter((b) => (b.getAttribute("aria-label") || "").startsWith("Agregar ")).length);
ok(agregar === 14, `14 botones "Agregar" (16 productos - 2 agotados) -> ${agregar}`);

await clic("Agregar Pan canilla"); // la primera vez el botón es «Agregar <producto>»; después pasa a «Agregar uno de …»
await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Ver pedido")));
ok(new RegExp(`^1\\s*Ver pedido.*\\$0,50.*${esc(bs(0.5))}`).test(await barra()), `barra tras agregar Pan canilla: "${await barra()}"`);

await clic("Agregar uno de Pan canilla");
ok(new RegExp(`^2\\s*Ver pedido.*\\$1,00.*${esc(bs(1))}`).test(await barra()), `subir a 2 -> "${await barra()}"`);

await page.reload({ waitUntil: "networkidle0" });
await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Ver pedido")));
ok(/^2\s*Ver pedido/.test(await barra()), "el carrito sobrevive a recargar la página");
ok(errores.filter((e) => /hydrat/i.test(e)).length === 0, "sin errores de hidratación al recargar con carrito guardado");

// Agrega otro producto y abre el pedido.
await page.evaluate(() => {
  const li = [...document.querySelectorAll("li")].find((l) => l.textContent.includes("Torta de cumpleaños"));
  [...li.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "").startsWith("Agregar")).click();
});
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Ver pedido")).click());
await page.waitForSelector("dialog[open]");
ok(true, "el pedido se abre como diálogo");
ok((await texto("dialog")).includes("$19,00") && (await texto("dialog")).includes(bs(19)), `total del diálogo: 2 x 0,50 + 18 = $19,00 / ${bs(19)}`);

// Con "Entrega a domicilio" aparece la dirección.
ok((await page.$('dialog input[autocomplete="street-address"]')) === null, "retiro: no se pide dirección");
await page.evaluate(() => [...document.querySelectorAll('dialog input[type=radio]')][1].click());
ok((await page.$('dialog input[autocomplete="street-address"]')) !== null, "domicilio: aparece el campo de dirección");

// Enviar sin nombre: el navegador debe bloquearlo (required).
await page.evaluate(() => document.querySelector("dialog form").requestSubmit());
ok((await page.evaluate(() => window.__wa)) === undefined, "sin nombre/dirección no se abre WhatsApp");

await page.type('dialog input[autocomplete="name"]', "Juan Pérez");
await page.type('dialog input[autocomplete="street-address"]', "Calle 1, Casa 2");
await page.type("dialog textarea", "Sin azúcar");
await page.evaluate(() => document.querySelector("dialog form").requestSubmit());
const url = await page.evaluate(() => window.__wa);
ok(!!url && url.startsWith(`https://wa.me/${real.tel}?text=`), "se abre wa.me con el número del local");
const msg = url ? decodeURIComponent(url.split("text=")[1]) : "";
console.log("---------- mensaje que recibiría el local ----------\n" + msg + "\n----------------------------------------------------");
ok(msg.includes(`2 x Pan canilla — $1,00 (${bs(1)})`) && msg.includes(`1 x Torta de cumpleaños — $18,00 (${bs(18)})`), "líneas con USD y Bs");
ok(new RegExp(`Código de tu pedido \\(no lo borres\\) 👇\\n\`\`\`\\[\\[PEDIDO v1\\|negocio=nueva-victoria\\|items=[0-9a-f]{8}x2,[0-9a-f]{8}x1\\|total=19\\.00\\|tasa=${Number(real.tasa.toFixed(4))}\\|entrega=domicilio\\]\\]\`\`\`$`).test(msg.trim()), "el mensaje termina con el código del pedido explicado y en monoespaciado");
ok(msg.includes(`*Total: $19,00 (${bs(19)})*`) && msg.includes("Entrega a domicilio: Calle 1, Casa 2") && msg.includes("Notas: Sin azúcar"), "total, entrega y notas");

await new Promise((r) => setTimeout(r, 300));
ok((await barra()) === null, "tras pedir, el carrito queda vacío");
ok((await page.evaluate(() => localStorage.getItem("carrito:nueva-victoria"))) === null, "y se borra del almacenamiento del celular");

// Carrito manipulado / corrupto no rompe la página.
await page.evaluate(() => localStorage.setItem("carrito:nueva-victoria", '{"no-existe":3,"x":-5}'));
await page.reload({ waitUntil: "networkidle0" });
ok((await barra()) === null && errores.filter((e) => !/hydrat/i.test(e)).length === 0, `carrito con datos basura: la página sigue bien (errores: ${errores.length})`);

console.log(errores.length ? "errores de consola:\n" + errores.join("\n") : "sin errores de consola");
await page.close();
await browser.disconnect();
console.log(`\n${resultados.filter(Boolean).length}/${resultados.length} pruebas correctas`);
process.exit(resultados.every(Boolean) ? 0 : 1);
