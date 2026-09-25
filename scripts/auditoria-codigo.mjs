// Auditoría de seguridad del código (solo lectura). Uso: node scripts/auditoria-codigo.mjs
// Sale con código 1 si encuentra algún PROBLEMA. Conviene correrla después de `npm run build`,
// porque también revisa lo que llega al navegador (.next/static).
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url)); // (decodifica los espacios de la ruta)
let problemas = 0;
const problema = (msg) => { problemas++; console.log("PROBLEMA  " + msg); };
const ok = (msg) => console.log("OK        " + msg);

function archivos(dir, ext = /\.(ts|tsx|mjs|js)$/) {
  const salida = [];
  for (const n of readdirSync(dir)) {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta, ext));
    else if (ext.test(n)) salida.push(ruta);
  }
  return salida;
}
const fuentes = archivos(join(raiz, "src"));

// 1) Toda acción de servidor debe comprobar la sesión ANTES de tocar datos.
//    Exentas: las de autenticación (la crean) y cerrarSesion (no toca datos: solo cierra la sesión de quien la llama).
const EXENTAS = new Set(["iniciarSesion", "verificarCodigo", "cerrarSesion"]);
const PUERTAS = /await\s+(requerirNegocio|requerirDueno|requerirSuperadmin|requerirSuperadminSinMfa|requerirUsuario)\s*\(/;
const ACCESO_DATOS = /\.(from|rpc|storage)\s*\(|datos\.get\(/;
let acciones = 0;
for (const f of fuentes) {
  const src = readFileSync(f, "utf8");
  if (!/^["']use server["']/m.test(src)) continue;
  const partes = src.split(/^export async function /m).slice(1);
  for (const parte of partes) {
    const nombre = parte.match(/^(\w+)/)[1];
    acciones++;
    if (EXENTAS.has(nombre)) continue;
    const cuerpo = parte.slice(parte.indexOf("{"));
    const puerta = cuerpo.search(PUERTAS);
    const datos = cuerpo.search(ACCESO_DATOS);
    if (puerta === -1) problema(`${relative(raiz, f)}: la acción ${nombre}() no comprueba la sesión`);
    else if (datos !== -1 && datos < puerta) problema(`${relative(raiz, f)}: la acción ${nombre}() toca datos antes de comprobar la sesión`);
  }
}
if (!problemas) ok(`${acciones} acciones de servidor comprueban la sesión antes de tocar datos`);

// 2) Puntos peligrosos en el código.
const PELIGROSOS = [/dangerouslySetInnerHTML/, /\beval\s*\(/, /new\s+Function\s*\(/, /\.innerHTML\s*=/, /document\.write\s*\(/, /insertAdjacentHTML/];
const antes = problemas;
for (const f of fuentes) {
  const src = readFileSync(f, "utf8");
  for (const p of PELIGROSOS) if (p.test(src)) problema(`${relative(raiz, f)}: usa ${p.source}`);
}
if (problemas === antes) ok("sin dangerouslySetInnerHTML, eval, innerHTML ni document.write");

// 3) Variables de entorno secretas en archivos que corren en el navegador.
const antes3 = problemas;
for (const f of fuentes) {
  const src = readFileSync(f, "utf8");
  if (!/^["']use client["']/m.test(src)) continue;
  for (const m of src.matchAll(/process\.env\.(\w+)/g)) if (!m[1].startsWith("NEXT_PUBLIC_") && m[1] !== "NODE_ENV") problema(`${relative(raiz, f)}: un componente de cliente lee process.env.${m[1]}`);
}
if (problemas === antes3) ok("ningún componente de cliente lee variables de entorno secretas");

// 4) Constantes exportadas desde un archivo "use client" (rompen los componentes de servidor: ver memoria del proyecto).
const antes4 = problemas;
for (const f of fuentes) {
  const src = readFileSync(f, "utf8");
  if (!/^["']use client["']/m.test(src)) continue;
  for (const m of src.matchAll(/^export\s+const\s+(\w+)\s*=\s*(?!async|\(|function)/gm)) problema(`${relative(raiz, f)}: exporta la constante ${m[1]} desde un archivo "use client"`);
}
if (problemas === antes4) ok('no se exportan constantes desde archivos "use client"');

// 5) Nada secreto en lo que llega al navegador (.next/static) ni en el repositorio.
const estatico = join(raiz, ".next/static");
if (existsSync(estatico)) {
  const antes5 = problemas;
  const buscar = [/sbp_[A-Za-z0-9]{20,}/, /service_role/, /SUPABASE_ACCESS_TOKEN/];
  let jwts = 0;
  for (const f of archivos(estatico, /\.(js|css|map)$/)) {
    const src = readFileSync(f, "utf8");
    for (const p of buscar) if (p.test(src)) problema(`.next/static/${relative(estatico, f)} contiene ${p.source}`);
    for (const m of src.matchAll(/eyJ[A-Za-z0-9_-]{15,}\.([A-Za-z0-9_-]{15,})\.[A-Za-z0-9_-]{15,}/g)) {
      jwts++;
      try {
        const rol = JSON.parse(Buffer.from(m[1], "base64url").toString()).role;
        if (rol !== "anon") problema(`.next/static/${relative(estatico, f)} contiene un JWT con role=${rol} (solo se admite anon)`);
      } catch { /* no era un JWT */ }
    }
  }
  if (problemas === antes5) ok(`el código del navegador no contiene secretos (${jwts} JWT, todos role=anon: la clave pública)`);
} else console.log("(omitido)  .next/static no existe: corre `npm run build` para revisar el código del navegador");

console.log(problemas ? `\n${problemas} problema(s)` : "\nSin problemas");
process.exit(problemas ? 1 : 0);
