"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requerirSuperadmin } from "@/lib/admin";
import { asegurarInstancia, evolutionConfigurado, nombreInstancia } from "@/lib/evolution";
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

// Crea (o reutiliza) la instancia de WhatsApp del local y la deja guardada. NUNCA hace fallar el alta: si
// Evolution no responde, el local queda "WhatsApp pendiente" y se puede reintentar. Es idempotente.
async function prepararInstancia(
  supabase: Awaited<ReturnType<typeof requerirSuperadmin>>["supabase"],
  negocioId: string,
  slug: string,
): Promise<string> {
  if (!evolutionConfigurado()) return "WhatsApp pendiente: falta configurar Evolution en el servidor.";

  const nombre = nombreInstancia(slug);
  const r = await asegurarInstancia(nombre);
  if (!r.ok) return `WhatsApp pendiente: ${r.mensaje} Puedes reintentar desde la lista de locales.`;

  const { error } = await supabase.rpc("fijar_instancia_evolution", { p_negocio: negocioId, p_nombre: nombre });
  if (error) {
    if (error.code === "23505") return "WhatsApp pendiente: ese nombre de instancia ya lo usa otro local.";
    return "WhatsApp pendiente: no se pudo guardar la instancia. Puedes reintentar desde la lista de locales.";
  }
  return r.valor.creada ? "Cuenta de WhatsApp creada." : "La cuenta de WhatsApp ya existía y quedó asociada al local.";
}

export async function crearLocal(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase } = await requerirSuperadmin();
    const nombre = leerTexto(datos, "nombre", "El nombre", 80, { requerido: true });
    const slug = leerSlug(datos, "slug", nombre);
    const tipo = leerTipo(datos, "tipo");
    const plan = leerPlan(datos, "plan");

    const { data: id, error } = await supabase.rpc("crear_negocio", { p_slug: slug, p_nombre: nombre, p_tipo: tipo, p_plan: plan });
    if (error) traducir("No se pudo crear el local", error);

    const whatsapp = await prepararInstancia(supabase, id as string, slug);
    publicar();
    return { ok: `Local creado: /${slug}. ${whatsapp} Ahora vincula a su dueño o arma su menú.` };
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

// Reintenta (o comprueba) la instancia de WhatsApp de un local ya creado.
export async function reintentarWhatsApp(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase } = await requerirSuperadmin();
    const id = leerId(datos, "negocio");
    const { data: negocio } = await supabase.from("negocios").select("slug").eq("id", id).maybeSingle();
    if (!negocio) throw new ErrorValidacion("No se encontró el local.");

    const mensaje = await prepararInstancia(supabase, id, negocio.slug as string);
    publicar();
    return mensaje.startsWith("WhatsApp pendiente") ? { error: mensaje } : { ok: mensaje };
  });
}
