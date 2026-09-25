import { headers } from "next/headers";
import QRCode from "qrcode";

// Dirección pública del sitio, en este orden: SITE_URL (la fija el dueño del producto cuando hay
// dominio propio), el dominio de producción que Vercel expone solo, y por último la petición
// actual (útil en local). Al cambiar a un dominio propio, el QR pasa a apuntar a él sin tocar código.
export async function urlBase(): Promise<string> {
  const fija = process.env.SITE_URL?.trim().replace(/\/+$/, "");
  if (fija) return fija;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function urlDelMenu(slug: string): Promise<string> {
  return `${await urlBase()}/${slug}`;
}

// SVG (nítido a cualquier tamaño, para imprimir) y PNG (para compartir). Se entregan como data URI.
export async function generarQR(url: string) {
  const opciones = { margin: 2, errorCorrectionLevel: "M" } as const;
  const [svg, png] = await Promise.all([
    QRCode.toString(url, { ...opciones, type: "svg" }),
    QRCode.toDataURL(url, { ...opciones, width: 1024 }),
  ]);
  return { svg: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, png };
}
