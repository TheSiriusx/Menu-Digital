import { formatBs, formatUsd, usdToBs } from "@/lib/precios";
import type { Producto } from "@/types/menu";

export const MAX_POR_PRODUCTO = 99;

// productoId -> cantidad
export type Carrito = Record<string, number>;

export type Linea = { producto: Producto; cantidad: number; subtotalUsd: number };

export type DatosPedido = {
  nombre: string;
  entrega: "retiro" | "domicilio";
  direccion: string;
  notas: string;
};

// Une el carrito con los productos actuales: descarta lo que ya no existe o está agotado y
// usa siempre el precio actual (el carrito solo guarda cantidades, nunca precios).
// `productos` debe venir en el orden en que se muestran.
export function lineasDelCarrito(carrito: Carrito, productos: Producto[]): Linea[] {
  const lineas: Linea[] = [];
  for (const producto of productos) {
    const cantidad = Math.min(carrito[producto.id] ?? 0, MAX_POR_PRODUCTO);
    if (!producto.disponible || !Number.isInteger(cantidad) || cantidad < 1) continue;
    lineas.push({
      producto,
      cantidad,
      subtotalUsd: (Math.round(producto.precio_usd * 100) * cantidad) / 100,
    });
  }
  return lineas;
}

export function totalUsd(lineas: Linea[]): number {
  return lineas.reduce((suma, l) => suma + Math.round(l.subtotalUsd * 100), 0) / 100;
}

export function cantidadTotal(lineas: Linea[]): number {
  return lineas.reduce((suma, l) => suma + l.cantidad, 0);
}

// Lee el carrito guardado en el navegador. El contenido no es de fiar (puede estar
// corrupto o manipulado), así que solo se aceptan cantidades enteras entre 1 y el máximo.
export function leerCarrito(raw: string | null): Carrito {
  if (!raw) return {};
  try {
    const datos: unknown = JSON.parse(raw);
    if (!datos || typeof datos !== "object" || Array.isArray(datos)) return {};
    const carrito: Carrito = {};
    for (const [id, cantidad] of Object.entries(datos)) {
      if (Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= MAX_POR_PRODUCTO) {
        carrito[id] = cantidad;
      }
    }
    return carrito;
  } catch {
    return {};
  }
}

// Una sola línea de texto, sin saltos, recortada.
function limpiar(texto: string, max: number): string {
  return texto.replace(/\s+/g, " ").trim().slice(0, max);
}

export function construirMensaje(
  negocio: { nombre: string; tasa_bs: number },
  lineas: Linea[],
  datos: DatosPedido,
): string {
  const tasa = negocio.tasa_bs;
  const conBs = (usd: number) => (tasa > 0 ? ` (${formatBs(usdToBs(usd, tasa))})` : "");
  const total = totalUsd(lineas);

  const partes = [
    `Hola *${negocio.nombre}*, quiero hacer un pedido:`,
    "",
    ...lineas.map(
      (l) => `${l.cantidad} x ${l.producto.nombre} — ${formatUsd(l.subtotalUsd)}${conBs(l.subtotalUsd)}`,
    ),
    "",
    `*Total: ${formatUsd(total)}${conBs(total)}*`,
  ];
  if (tasa > 0) partes.push(`Tasa del día: ${formatBs(tasa)} por $1`);

  partes.push("", `Nombre: ${limpiar(datos.nombre, 60)}`);
  partes.push(
    datos.entrega === "domicilio"
      ? `Entrega a domicilio: ${limpiar(datos.direccion, 200)}`
      : "Retiro en el local",
  );
  const notas = limpiar(datos.notas, 300);
  if (notas) partes.push(`Notas: ${notas}`);

  return partes.join("\n");
}

// wa.me exige solo dígitos con código de país. Acepta "0412-1234567" (formato local de
// Venezuela) y lo convierte a 58412...; devuelve null si el número no es utilizable.
export function normalizarTelefono(telefono: string | null): string | null {
  if (!telefono) return null;
  let digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  else if (digitos.startsWith("0")) digitos = `58${digitos.slice(1)}`;
  return digitos.length >= 10 && digitos.length <= 15 ? digitos : null;
}

export function urlWhatsApp(telefono: string | null, mensaje: string): string | null {
  const numero = normalizarTelefono(telefono);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : null;
}
