import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Categoria, Negocio, Producto } from "@/types/menu";

// Sesión del panel. Se llama en cada página y en cada acción: el proxy y el layout NO bastan.
// `cache` evita repetir las consultas dentro de una misma petición.
export const obtenerSesion = cache(async () => {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, negocioId: null };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("negocio_id, rol")
    .eq("id", user.id)
    .maybeSingle();

  return { supabase, user, negocioId: (perfil?.negocio_id as string | null) ?? null };
});

// Devuelve el cliente y el negocio del dueño, o redirige. Toda acción y página del panel lo usa.
export async function requerirDueno() {
  const { supabase, user, negocioId } = await obtenerSesion();
  if (!user) redirect("/login");
  if (!negocioId) redirect("/admin/sin-cuenta");
  return { supabase, user, negocioId };
}

const COLUMNAS_NEGOCIO =
  "id, slug, nombre, tipo, logo_url, color, telefono_whatsapp, horario, tasa_bs, activo";

export type Panel = { negocio: Negocio; categorias: Categoria[]; productos: Producto[] };

export async function cargarPanel(): Promise<Panel> {
  const { supabase, negocioId } = await requerirDueno();

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
