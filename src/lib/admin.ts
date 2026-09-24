import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { leerId } from "@/lib/validacion";
import type { Categoria, Negocio, Producto } from "@/types/menu";

export type Rol = "dueno" | "superadmin";

// Sesión del panel. Se llama en cada página y en cada acción: el proxy y el layout NO bastan.
// `cache` evita repetir las consultas dentro de una misma petición.
export const obtenerSesion = cache(async () => {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, negocioId: null, rol: null as Rol | null };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("negocio_id, rol")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    user,
    negocioId: (perfil?.negocio_id as string | null) ?? null,
    rol: (perfil?.rol as Rol | undefined) ?? null,
  };
});

// Cualquier usuario con sesión (p. ej. para cambiar su propia contraseña).
export async function requerirUsuario() {
  const { supabase, user } = await obtenerSesion();
  if (!user) redirect("/login");
  return supabase;
}

// Páginas del dueño (/admin). El super admin no tiene un local propio: va a su panel.
export async function requerirDueno() {
  const { supabase, user, negocioId, rol } = await obtenerSesion();
  if (!user) redirect("/login");
  if (rol === "superadmin") redirect("/superadmin");
  if (!negocioId) redirect("/admin/sin-cuenta");
  return { supabase, user, negocioId };
}

// Páginas y acciones del super admin (/superadmin).
export async function requerirSuperadmin() {
  const { supabase, user, rol } = await obtenerSesion();
  if (!user) redirect("/login");
  if (rol !== "superadmin") redirect("/admin");
  return { supabase, user };
}

// Acciones de edición del panel. El local sale SIEMPRE del perfil del dueño (se ignora lo que
// llegue en el formulario). Solo el super admin elige el local, con el campo oculto "negocio";
// aun así la base de datos (RLS) es la que decide qué filas se pueden tocar.
export async function requerirNegocio(datos: FormData) {
  const { supabase, user, negocioId, rol } = await obtenerSesion();
  if (!user) redirect("/login");
  if (rol === "superadmin") return { supabase, negocioId: leerId(datos, "negocio") };
  if (!negocioId) redirect("/admin/sin-cuenta");
  return { supabase, negocioId };
}

// Local por su enlace, para las páginas /superadmin/locales/[slug].
export const cargarLocalPorSlug = cache(async (slug: string) => {
  const { supabase } = await requerirSuperadmin();
  const { data } = await supabase
    .from("negocios")
    .select("id, slug, nombre, activo")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) notFound();
  return data as { id: string; slug: string; nombre: string; activo: boolean };
});

const COLUMNAS_NEGOCIO =
  "id, slug, nombre, tipo, logo_url, color, telefono_whatsapp, horario, tasa_bs, activo";

export type Panel = { negocio: Negocio; categorias: Categoria[]; productos: Producto[] };

// Lee el panel de UN local. Quien llama ya comprobó la sesión y eligió el local.
export async function cargarPanel(negocioId: string): Promise<Panel> {
  const supabase = await crearClienteServidor();

  // Se filtra por negocio_id además de RLS: las políticas de lectura pública también
  // dejan ver, a cualquier usuario, el catálogo activo de otros locales.
  const [negocio, categorias, productos] = await Promise.all([
    supabase.from("negocios").select(COLUMNAS_NEGOCIO).eq("id", negocioId).single(),
    supabase
      .from("categorias")
      .select("id, nombre, orden")
      .eq("negocio_id", negocioId)
      .order("orden")
      .order("id"),
    supabase
      .from("productos")
      .select("id, categoria_id, nombre, descripcion, precio_usd, disponible, foto_url, orden")
      .eq("negocio_id", negocioId)
      .order("orden")
      .order("id"),
  ]);

  if (negocio.error) throw new Error(`No se pudo leer el negocio: ${negocio.error.message}`);
  if (categorias.error) throw new Error(`No se pudieron leer las categorías: ${categorias.error.message}`);
  if (productos.error) throw new Error(`No se pudieron leer los productos: ${productos.error.message}`);

  return {
    negocio: { ...(negocio.data as Negocio), tasa_bs: Number(negocio.data.tasa_bs) },
    categorias: categorias.data as Categoria[],
    productos: (productos.data as Producto[]).map((p) => ({ ...p, precio_usd: Number(p.precio_usd) })),
  };
}

export async function cargarPanelDueno(): Promise<Panel> {
  const { negocioId } = await requerirDueno();
  return cargarPanel(negocioId);
}
