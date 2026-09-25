import { SUPABASE_URL } from "@/lib/supabase/env";

export const BUCKET = "menu-media";

// El navegador ya reduce la foto (~30 KB); este tope es la comprobación del servidor, que no
// se fía de lo que haga el navegador.
export const MAX_BYTES_IMAGEN = 300_000;

export type FormatoImagen = "webp" | "jpeg" | "png";

export const MIME: Record<FormatoImagen, string> = {
  webp: "image/webp",
  jpeg: "image/jpeg",
  png: "image/png",
};

// Detecta el formato por los primeros bytes (no por el nombre ni por el tipo declarado).
// SVG no se acepta a propósito: puede llevar scripts.
export function detectarFormato(bytes: Uint8Array): FormatoImagen | null {
  const empieza = (...firma: number[]) => firma.every((b, i) => bytes[i] === b);
  if (empieza(0xff, 0xd8, 0xff)) return "jpeg";
  if (empieza(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  // WebP: "RIFF" + 4 bytes de tamaño + "WEBP"
  if (bytes.length >= 12 && empieza(0x52, 0x49, 0x46, 0x46) && [0x57, 0x45, 0x42, 0x50].every((b, i) => bytes[8 + i] === b)) {
    return "webp";
  }
  return null;
}

export function urlPublica(ruta: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${ruta}`;
}

// De una URL pública nuestra devuelve la ruta "{local}/{archivo}" en el bucket; null si la URL no
// es de nuestro Storage o no pertenece a ese local (nunca se borra nada ajeno).
export function rutaDesdeUrl(url: string | null, negocioId: string): string | null {
  if (!url) return null;
  const prefijo = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${negocioId}/`;
  if (!url.startsWith(prefijo)) return null;
  const archivo = url.slice(prefijo.length);
  return /^[A-Za-z0-9._-]{1,100}$/.test(archivo) && !archivo.includes("..") ? `${negocioId}/${archivo}` : null;
}
