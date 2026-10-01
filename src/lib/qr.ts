import QRCode from "qrcode";
import { urlBase } from "@/lib/sitio";

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
