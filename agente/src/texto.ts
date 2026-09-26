// Utilidades de texto y dinero. Los importes se formatean igual que en el menú web (src/lib/precios.ts).
import { formatBs, formatUsd, usdToBs } from "../../src/lib/precios.ts";

export { formatBs, formatUsd, usdToBs };

// minúsculas, sin acentos ni signos, espacios simples: para comparar lo que escribe la gente.
export function normalizar(texto: string | null | undefined): string {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// "$3,50 (Bs 175,00)" o solo "$3,50" si no hay tasa.
export function precio(usd: number, tasa: number): string {
  return tasa > 0 ? `${formatUsd(usd)} (${formatBs(usdToBs(usd, tasa))})` : formatUsd(usd);
}

// Código corto de un pedido para mostrar: "#A1B2C3D4".
export const codigoPedido = (idOCodigo: string) => `#${idOCodigo.slice(0, 8).toUpperCase()}`;

export function primerNombre(nombre: string | null | undefined): string {
  const n = String(nombre ?? "").trim().split(/\s+/)[0] ?? "";
  return /\p{L}/u.test(n) ? n.slice(0, 30) : "";
}

// Texto que viene del cliente y se le reenvía al dueño: una línea, sin caracteres de control, con tope.
export function limpio(texto: string | null | undefined, max: number): string {
  return String(texto ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export const soloDigitos = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "");
