// Toda la lógica de dinero vive aquí. Los precios se guardan en USD; el Bs se calcula al mostrar.

const formatoNumero = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Convierte USD a Bs redondeando a 2 decimales. Se opera en centavos para evitar
// errores de coma flotante (ej. 0.30 * 50 = 15.000000000000002).
export function usdToBs(usd: number, tasa: number): number {
  return Math.round(Math.round(usd * 100) * tasa) / 100;
}

export function formatUsd(usd: number): string {
  return `$${formatoNumero.format(usd)}`;
}

export function formatBs(bs: number): string {
  return `Bs ${formatoNumero.format(bs)}`;
}
