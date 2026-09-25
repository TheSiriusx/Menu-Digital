// El dueño puede elegir cualquier color de acento. El texto que va encima (botones, chips)
// se elige solo entre blanco y negro, el que más contraste dé (WCAG), para que siempre se lea.

export const ACENTO_POR_DEFECTO = "#111111";
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

// Negro puro (no gris) para garantizar al menos 4,5:1 con cualquier fondo que no admita el blanco.
export function colorSobre(hex: string): "#ffffff" | "#000000" {
  return contraste(hex, "#ffffff") >= contraste(hex, "#000000") ? "#ffffff" : "#000000";
}

export function acentoDe(color: string | null): { acento: string; sobre: string } {
  const acento = esColorHex(color) ? color : ACENTO_POR_DEFECTO;
  return { acento, sobre: colorSobre(acento) };
}
