import { normalizarTelefono } from "@/lib/pedido";

// Estado que devuelven las acciones de formulario del panel.
export type Estado = { error?: string; ok?: string };

// Error con un mensaje pensado para mostrarse tal cual al dueño.
export class ErrorValidacion extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ejecuta una acción y convierte los ErrorValidacion en un Estado; cualquier otro error se propaga.
export async function conValidacion(accion: () => Promise<Estado>): Promise<Estado> {
  try {
    return await accion();
  } catch (e) {
    if (e instanceof ErrorValidacion) return { error: e.message };
    throw e;
  }
}

function bruto(datos: FormData, campo: string): string {
  const valor = datos.get(campo);
  return typeof valor === "string" ? valor : "";
}

export function leerId(datos: FormData, campo: string): string {
  const valor = bruto(datos, campo);
  if (!UUID.test(valor)) throw new ErrorValidacion("Solicitud no válida. Recarga la página e inténtalo de nuevo.");
  return valor;
}

export function leerIdOpcional(datos: FormData, campo: string): string | null {
  return bruto(datos, campo) === "" ? null : leerId(datos, campo);
}

export function leerTexto(
  datos: FormData,
  campo: string,
  etiqueta: string,
  max: number,
  opciones: { requerido?: boolean } = {},
): string {
  const valor = bruto(datos, campo).replace(/\s+/g, " ").trim();
  if (opciones.requerido && !valor) throw new ErrorValidacion(`${etiqueta} es obligatorio.`);
  if (valor.length > max) throw new ErrorValidacion(`${etiqueta} no puede pasar de ${max} caracteres.`);
  return valor;
}

// Acepta "1.5" y "1,5". Máximo 2 decimales (centavos).
export function leerPrecioUsd(datos: FormData, campo: string): number {
  const texto = bruto(datos, campo).trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(texto)) {
    throw new ErrorValidacion("El precio debe ser un número en dólares con hasta 2 decimales, por ejemplo 1,50.");
  }
  const numero = Number(texto);
  if (numero > 100000) throw new ErrorValidacion("El precio es demasiado alto.");
  return numero;
}

// Bs por 1 USD: mayor que 0, hasta 4 decimales.
export function leerTasaBs(datos: FormData, campo: string): number {
  const texto = bruto(datos, campo).trim().replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,4})?$/.test(texto)) {
    throw new ErrorValidacion("La tasa debe ser un número, por ejemplo 52,35.");
  }
  const numero = Number(texto);
  if (numero <= 0 || numero >= 1_000_000) throw new ErrorValidacion("La tasa debe ser mayor que 0.");
  return numero;
}

export function leerColor(datos: FormData, campo: string): string | null {
  const valor = bruto(datos, campo).trim();
  if (valor === "") return null;
  if (!/^#[0-9a-fA-F]{6}$/.test(valor)) throw new ErrorValidacion("El color debe tener el formato #RRGGBB.");
  return valor;
}

// Guarda solo dígitos con código de país (lo que exige wa.me). Vacío = sin WhatsApp configurado.
export function leerTelefono(datos: FormData, campo: string): string | null {
  const valor = bruto(datos, campo).trim();
  if (valor === "") return null;
  const numero = normalizarTelefono(valor);
  if (!numero) {
    throw new ErrorValidacion("Escribe el WhatsApp con código de país, por ejemplo 584121234567 o 0412-1234567.");
  }
  return numero;
}
