"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requerirSuperadmin } from "@/lib/admin";
import {
  conValidacion,
  ErrorValidacion,
  leerCorreo,
  leerId,
  leerPlan,
  leerSlug,
  leerTexto,
  leerTipo,
  type Estado,
} from "@/lib/validacion";

// Pausar/activar cambia lo que ve el público: se vacía la caché del menú al instante.
function publicar() {
  updateTag("menu");
  revalidatePath("/superadmin", "layout");
  revalidatePath("/admin", "layout");
}

// Traduce los errores de las funciones SQL (y de sus restricciones) a mensajes para el super admin.
function traducir(contexto: string, error: { code?: string; message: string }): never {
  const m = error.message;
  if (error.code === "23505") throw new ErrorValidacion("Ese enlace ya está en uso por otro local.");
  if (error.code === "23514") {
    if (m.includes("slug_reservado")) throw new ErrorValidacion("Ese enlace está reservado por el sistema. Elige otro.");
    if (m.includes("slug_formato")) throw new ErrorValidacion("El enlace debe tener de 3 a 60 caracteres: minúsculas, números y guiones.");
    if (m.includes("nombre_largo")) throw new ErrorValidacion("El nombre debe tener entre 1 y 80 caracteres.");
  }
  if (error.code === "P0002" || error.code === "22023") throw new ErrorValidacion(m);
  if (error.code === "42501") throw new ErrorValidacion("No autorizado.");
  throw new Error(`${contexto}: ${m}`);
}

export async function crearLocal(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase } = await requerirSuperadmin();
    const nombre = leerTexto(datos, "nombre", "El nombre", 80, { requerido: true });
    const slug = leerSlug(datos, "slug", nombre);
    const tipo = leerTipo(datos, "tipo");
    const plan = leerPlan(datos, "plan");

    const { error } = await supabase.rpc("crear_negocio", { p_slug: slug, p_nombre: nombre, p_tipo: tipo, p_plan: plan });
    if (error) traducir("No se pudo crear el local", error);
    publicar();
    return { ok: `Local creado: /${slug}. Ahora vincula a su dueño o arma su menú.` };
  });
}

export async function cambiarEstado(datos: FormData) {
  const { supabase } = await requerirSuperadmin();
  const id = leerId(datos, "negocio");
  const activo = String(datos.get("activo")) === "true";
  const { error } = await supabase.rpc("cambiar_estado_negocio", { p_negocio: id, p_activo: activo });
  if (error) traducir("No se pudo cambiar el estado", error);
  publicar();
}

export async function cambiarPlan(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase } = await requerirSuperadmin();
    const id = leerId(datos, "negocio");
    const plan = leerPlan(datos, "plan");
    const { error } = await supabase.rpc("cambiar_plan_negocio", { p_negocio: id, p_plan: plan });
    if (error) traducir("No se pudo cambiar el plan", error);
    publicar();
    return { ok: "Plan actualizado." };
  });
}

export async function vincularDueno(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase } = await requerirSuperadmin();
    const id = leerId(datos, "negocio");
    const correo = leerCorreo(datos, "correo");
    const { error } = await supabase.rpc("vincular_dueno", { p_correo: correo, p_negocio: id });
    if (error) traducir("No se pudo vincular al dueño", error);
    publicar();
    return { ok: `${correo} ahora es dueño de este local.` };
  });
}

export async function quitarDueno(datos: FormData) {
  const { supabase } = await requerirSuperadmin();
  const id = leerId(datos, "negocio");
  const correo = leerCorreo(datos, "correo");
  const { error } = await supabase.rpc("quitar_dueno", { p_correo: correo, p_negocio: id });
  if (error) traducir("No se pudo quitar al dueño", error);
  publicar();
}
