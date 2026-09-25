// Sube fotos de demostración (por la API real de Storage) y las asigna a productos y al logo.
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const S = decodeURIComponent(new URL("..", import.meta.url).pathname);
const env = Object.fromEntries(readFileSync(S + "e2e4.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const L = Object.fromEntries(readFileSync("/home/thesirius/Documentos/Menu digital/.env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const sql = (q) => JSON.parse(execFileSync("python3", ["-c", "import sys,json;sys.path.insert(0,sys.argv[1]);from db import sql;print(json.dumps(sql(sys.argv[2])))", S, q]).toString());

const browser = await puppeteer.connect({ browserWSEndpoint: "ws://127.0.0.1:9222/session", protocol: "webDriverBiDi" });
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.goto("http://localhost:3100/login");

const dibujar = (emoji, c1, c2, lado) => page.evaluate(async (emoji, c1, c2, lado) => {
  const c = document.createElement("canvas"); c.width = c.height = lado; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, lado, lado); g.addColorStop(0, c1); g.addColorStop(1, c2);
  x.fillStyle = g; x.fillRect(0, 0, lado, lado);
  x.font = `${lado * 0.55}px "Noto Color Emoji", "Apple Color Emoji", sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(emoji, lado / 2, lado / 2 + lado * 0.04);
  const b = await new Promise((r) => c.toBlob(r, "image/webp", 0.85));
  return Array.from(new Uint8Array(await b.arrayBuffer()));
}, emoji, c1, c2, lado);

const token = (await (await fetch(`${L.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: L.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: env.SA_CORREO, password: env.SA_CLAVE }) })).json()).access_token;
const nv = sql("select id from negocios where slug='nueva-victoria'")[0].id;

const base = `${L.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object`;
async function subir(bytes, nombre) {
  const r = await fetch(`${base}/menu-media/${nv}/${nombre}`, { method: "POST", headers: { apikey: L.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "image/webp" }, body: Uint8Array.from(bytes) });
  if (!r.ok) throw new Error("subida " + nombre + " " + r.status + " " + (await r.text()));
  return `${base}/public/menu-media/${nv}/${nombre}`;
}

const fotos = [
  ["Pan canilla", "🥖", "#fde68a", "#f59e0b"], ["Pan integral", "🍞", "#d6c7a1", "#a16207"],
  ["Cachito de jamón", "🥐", "#fed7aa", "#ea580c"], ["Croissant", "🥐", "#fef3c7", "#d97706"],
  ["Torta de chocolate", "🍰", "#fecdd3", "#9f1239"], ["Café con leche", "☕", "#e7d5c3", "#78350f"],
  ["Quesillo", "🍮", "#fef08a", "#ca8a04"], ["Tequeños x10", "🍢", "#fde68a", "#b45309"],
];
for (const [nombre, emoji, c1, c2] of fotos) {
  const url = await subir(await dibujar(emoji, c1, c2, 480), `demo-${nombre.replace(/\W+/g, "-")}.webp`);
  sql(`update productos set foto_url = '${url}' where nombre = '${nombre}' and negocio_id = '${nv}'`);
}
const logo = await subir(await dibujar("🥖", "#fef3c7", "#f59e0b", 256), "demo-logo.webp");
sql(`update negocios set logo_url = '${logo}' where id = '${nv}'`);
console.log("fotos de demostración:", sql("select count(*) n from productos where foto_url is not null")[0].n, "+ logo");
await ctx.close(); await browser.disconnect();
