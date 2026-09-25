import { normalizarTelefono } from "@/lib/pedido";
import { PLANES, TIPOS } from "@/lib/tipos";

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

// Enlace (slug) a partir de un nombre: "Panadería La Espiga" -> "panaderia-la-espiga".
export function slugDesde(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

// Si el campo viene vacío se genera desde el nombre. El formato y los slugs reservados
// también los exige la base de datos; aquí solo se da un mensaje claro antes.
export function leerSlug(datos: FormData, campo: string, nombre: string): string {
  const escrito = bruto(datos, campo).trim().toLowerCase();
  const slug = escrito || slugDesde(nombre);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 60) {
    throw new ErrorValidacion("El enlace debe tener de 3 a 60 caracteres: solo minúsculas, números y guiones (ej. la-espiga).");
  }
  return slug;
}

export function leerTipo(datos: FormData, campo: string): string {
  const valor = bruto(datos, campo);
  if (!TIPOS.some((t) => t.valor === valor)) throw new ErrorValidacion("Elige un tipo de negocio.");
  return valor;
}

export function leerPlan(datos: FormData, campo: string): string {
  const valor = bruto(datos, campo);
  if (!PLANES.some((p) => p.valor === valor)) throw new ErrorValidacion("Elige un plan.");
  return valor;
}

export function leerCorreo(datos: FormData, campo: string): string {
  const valor = bruto(datos, campo).trim().toLowerCase();
  if (valor.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
    throw new ErrorValidacion("Escribe un correo válido.");
  }
  return valor;
}

// Stock: vacío = sin control (null); si no, un entero entre 0 y 1.000.000.
export function leerStock(datos: FormData, campo: string): number | null {
  const texto = bruto(datos, campo).trim();
  if (texto === "") return null;
  if (!/^\d{1,7}$/.test(texto) || Number(texto) > 1_000_000) {
    throw new ErrorValidacion("El stock debe ser un número entero de 0 en adelante, o vacío si no llevas control.");
  }
  return Number(texto);
}
