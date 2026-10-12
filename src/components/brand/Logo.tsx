// Logo de Pidelo. Siempre el archivo completo de public/brand/ (nunca rehecho con texto o CSS), escalado sin
// deformar, sin sombras ni colores cambiados.
//   imagotipo: P y nombre lado a lado (el principal: cabeceras y pantallas) · isotipo: solo la P (espacios chicos)
//   isologo: P y nombre en círculo (login, sellos) · logotipo: solo el nombre (cuando la P ya está cerca)
// Tonos: principal sobre claro; reverso sobre azul, deep y en tema oscuro; blanco sobre fotos u oscuros; mono, una
// sola tinta. Donde va «principal», en tema oscuro se muestra «reverso».

export type VarianteLogo = "imagotipo" | "isotipo" | "isologo" | "logotipo";
export type TonoLogo = "principal" | "reverso" | "blanco" | "mono";

// Proporción (ancho / alto) según el viewBox de cada archivo, tamaño mínimo en pantalla (ancho, px) y ancho del
// tallo de la P respecto al alto, que es el margen libre que pide el manual alrededor del logo.
const MEDIDAS: Record<VarianteLogo, { proporcion: number; minimo: number; tallo: number }> = {
  imagotipo: { proporcion: 411.79 / 155, minimo: 112, tallo: 32 / 155 },
  isotipo: { proporcion: 1, minimo: 16, tallo: 32 / 155 },
  isologo: { proporcion: 1, minimo: 40, tallo: (32 * 0.5468) / 200 },
  logotipo: { proporcion: 289.79 / 89.91, minimo: 72, tallo: 15.32 / 89.91 },
};

// Si quien lo usa ya decide cómo se muestra (hidden, block, lg:hidden…), no se le impone inline-block.
const visualizacion = (className: string) => (/(^|\s)(hidden|block|inline-block|flex|inline-flex)(\s|$)/.test(className) ? "" : "inline-block");

const archivo = (variante: VarianteLogo, tono: TonoLogo) => `/brand/${variante}${tono === "principal" ? "" : `-${tono}`}.svg`;

export function Logo({
  variant,
  tone = "principal",
  width,
  alt = "Pidelo",
  className = "",
}: {
  variant: VarianteLogo;
  tone?: TonoLogo;
  /** Ancho en px; nunca menos que el mínimo del manual para esa variante. */
  width: number;
  /** Texto alternativo; "" si al lado ya se lee «Pidelo». */
  alt?: string;
  className?: string;
}) {
  const { proporcion, minimo, tallo } = MEDIDAS[variant];
  const ancho = Math.max(width, minimo);
  const alto = Math.round(ancho / proporcion);
  const imagen = (t: TonoLogo, extra = "") => (
    // eslint-disable-next-line @next/next/no-img-element -- SVG fijo de la marca: se escala tal cual
    <img src={archivo(variant, t)} alt={alt} width={ancho} height={alto} className={`block h-auto max-w-none ${extra}`} style={{ width: ancho }} />
  );
  return (
    // El margen libre va como relleno: dentro de él no entra texto, borde ni otro logo.
    <span className={`${visualizacion(className)} shrink-0 ${className}`} style={{ padding: Math.round(alto * tallo) }}>
      {tone === "principal" ? (
        <>
          {imagen("principal", "dark:hidden")}
          {imagen("reverso", "hidden dark:block")}
        </>
      ) : (
        imagen(tone)
      )}
    </span>
  );
}

// Variantes de apoyo del isotipo (solo isotipo): Bolsa para los estados vacíos de pedidos, Pin para delivery y
// Sonrisa para la página 404 y los mensajes amables. Tamaño mínimo 16 px, como el isotipo.
export function IsotipoApoyo({ forma, width, alt = "", className = "" }: { forma: "bolsa" | "pin" | "sonrisa"; width: number; alt?: string; className?: string }) {
  const ancho = Math.max(width, 16);
  const imagen = (sufijo: string, extra: string) => (
    // eslint-disable-next-line @next/next/no-img-element -- SVG fijo de la marca: se escala tal cual
    <img src={`/brand/${forma}-isotipo${sufijo}.svg`} alt={alt} width={ancho} height={ancho} className={`block h-auto max-w-none ${extra}`} style={{ width: ancho }} />
  );
  return (
    <span className={`${visualizacion(className)} shrink-0 ${className}`} style={{ padding: Math.round(ancho * (32 / 155)) }}>
      {imagen("", "dark:hidden")}
      {imagen("-reverso", "hidden dark:block")}
    </span>
  );
}
