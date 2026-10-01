import { headers } from "next/headers";

// Dirección pública del sitio (los menús viven en {base}/{slug}). Sale SOLO de NEXT_PUBLIC_BASE_URL, que se
// fija en Vercel (y en .env.local si hace falta); al cambiar de dominio basta con cambiarla y redesplegar.
// Si no está puesta (p. ej. en local), se usa la dirección de la propia petición.
export async function urlBase(): Promise<string> {
  const fija = urlBaseFija();
  if (fija) return fija;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Solo la configurada (null si no hay). «midominio.com/» -> «https://midominio.com»; lo que no es URL se ignora.
export function urlBaseFija(): string | null {
  const v = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//.test(v) ? v : `https://${v}`);
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}
