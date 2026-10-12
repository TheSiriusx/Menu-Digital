import { COLORES } from "@/lib/colores-marca";

// El dueño puede elegir cualquier color de acento para su menú. El texto que va encima (botones, chips) es deep o
// surface-100 de Pidelo, el que dé al menos 4,5:1 (WCAG); con los tonos medios en que ninguno llega, negro o blanco.

// Sin color elegido, el menú usa el azul de Pidelo.
export const ACENTO_POR_DEFECTO = COLORES.brand;
const COLOR_HEX = /^#[0-9a-fA-F]{6}$/;

export function esColorHex(valor: string | null | undefined): valor is string {
  return !!valor && COLOR_HEX.test(valor);
}

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

// Texto sobre el color del local: deep o surface-100 si alguno llega a 4,5:1 (el de más contraste). Con los tonos
// medios (p. ej. un verde #4C8B58: 4,4:1 y 3,7:1) ninguno llega, y entonces va negro o blanco puros, que siempre sí.
export function colorSobre(hex: string): string {
  const [mejor] = [COLORES.deep, COLORES.surface100].sort((a, b) => contraste(hex, b) - contraste(hex, a));
  if (contraste(hex, mejor) >= 4.5) return mejor;
  return contraste(hex, "#ffffff") >= contraste(hex, "#000000") ? "#ffffff" : "#000000";
}

// Mezcla dos colores (0 = a, 1 = b).
function mezclar(a: string, b: string, t: number): string {
  const c = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  return "#" + [1, 3, 5].map((i) => Math.round(c(a, i) * (1 - t) + c(b, i) * t).toString(16).padStart(2, "0")).join("");
}

// El acento como TEXTO sobre fondo claro (precios, enlaces): si no llega a 4,5:1, se oscurece hasta que se lea.
export function textoLegible(hex: string, fondo = "#ffffff"): string {
  for (let t = 0; t <= 1; t += 0.05) {
    const c = mezclar(hex, "#24201b", t);
    if (contraste(c, fondo) >= 4.5) return c;
  }
  return "#24201b";
}

export function acentoDe(color: string | null): { acento: string; sobre: string; texto: string } {
  const acento = esColorHex(color) ? color : ACENTO_POR_DEFECTO;
  return { acento, sobre: colorSobre(acento), texto: textoLegible(acento) };
}

// Variables CSS del acento de un local, para el atributo style de su menú o su panel.
export function variablesAcento(color: string | null): Record<string, string> {
  const { acento, sobre, texto } = acentoDe(color);
  return { "--acento": acento, "--sobre-acento": sobre, "--acento-texto": texto };
}
