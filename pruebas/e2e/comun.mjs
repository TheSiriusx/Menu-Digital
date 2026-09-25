// Utilidades de pruebas para la verificación en dos pasos (TOTP, RFC 6238).
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(texto) {
  let bits = "";
  for (const c of texto.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totp(secreto, t = Date.now()) {
  const paso = Buffer.alloc(8);
  paso.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const h = createHmac("sha1", base32(secreto)).update(paso).digest();
  const o = h[19] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

// Un código TOTP no debe repetirse en la misma ventana de 30 s: si ya se usó, se espera al siguiente.
const usados = new Set();
export function marcarUsado(codigo) { usados.add(codigo); }
export async function codigoFresco(secreto) {
  for (;;) {
    const c = totp(secreto);
    if (!usados.has(c)) { usados.add(c); return c; }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

export function leerEnv(ruta) {
  return Object.fromEntries(readFileSync(ruta, "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
}

// Sesión con segundo factor verificado (aal2), para llamar a la API como super admin.
export async function tokenAal2(supa, anon, correo, clave, secreto) {
  const cab = (t) => ({ apikey: anon, "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) });
  const json = async (r) => { const d = await r.json(); if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(d).slice(0, 200)}`); return d; };
  const t1 = (await json(await fetch(`${supa}/auth/v1/token?grant_type=password`, { method: "POST", headers: cab(), body: JSON.stringify({ email: correo, password: clave }) }))).access_token;
  const usuario = await json(await fetch(`${supa}/auth/v1/user`, { headers: cab(t1) }));
  const factor = usuario.factors.find((f) => f.status === "verified");
  const desafio = await json(await fetch(`${supa}/auth/v1/factors/${factor.id}/challenge`, { method: "POST", headers: cab(t1), body: "{}" }));
  const codigo = await codigoFresco(secreto);
  return (await json(await fetch(`${supa}/auth/v1/factors/${factor.id}/verify`, { method: "POST", headers: cab(t1), body: JSON.stringify({ challenge_id: desafio.id, code: codigo }) }))).access_token;
}

// Tras pulsar "Entrar": si aparece el paso de verificación, escribe el código.
export async function pasoCodigo(page, secreto) {
  if (!secreto) return;
  await page.waitForFunction(() => location.pathname !== "/login", { timeout: 10000 }).catch(() => {});
  if (new URL(page.url()).pathname !== "/login/verificar") return;
  await page.$eval("input[name=codigo]", (e, v) => (e.value = v), await codigoFresco(secreto));
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Verificar").click());
  await page.waitForFunction(() => location.pathname !== "/login/verificar", { timeout: 10000 }).catch(() => {});
  await page.waitForNetworkIdle?.({ idleTime: 600, timeout: 8000 }).catch(() => {});
}
