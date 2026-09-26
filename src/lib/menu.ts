import { cache } from "react";
import { supabase } from "@/lib/supabase";
import type { Categoria, Menu, Negocio, Producto } from "@/types/menu";

// Con la clave pública hay que pedir columnas explícitas (no select('*')): ver 0002_rls.sql.
const COLUMNAS_NEGOCIO =
  "id, slug, nombre, tipo, logo_url, color, telefono_whatsapp, horario, tasa_bs, activo";
const COLUMNAS_CATEGORIA = "id, nombre, orden";
const COLUMNAS_PRODUCTO =
  "id, categoria_id, nombre, descripcion, precio_usd, disponible, foto_url, orden";

// Mismo formato que exige la base de datos (negocios_slug_formato). Evita consultar por
// rutas que no pueden ser un slug, como /favicon.ico o /robots.txt.
const SLUG_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Devuelve null si el negocio no existe. Un negocio pausado (activo = false) se devuelve
// sin categorías ni productos: la base de datos tampoco los entrega (RLS).
// `cache` evita repetir la consulta cuando generateMetadata y la página piden lo mismo.
export const getMenuBySlug = cache(async (slug: string): Promise<Menu | null> => {
  if (!SLUG_VALIDO.test(slug)) return null;

  const { data: negocio, error } = await supabase
    .from("negocios")
    .select(COLUMNAS_NEGOCIO)
    .eq("slug", slug)
    .maybeSingle<Negocio>();

  // Un error de base de datos NO es un 404: se propaga para que Next muestre el error.
  if (error) throw new Error(`No se pudo leer el negocio "${slug}": ${error.message}`);
  if (!negocio) return null;

  const tasa_bs = Number(negocio.tasa_bs);
  const base: Negocio = { ...negocio, tasa_bs };
  if (!negocio.activo) return { negocio: base, soloRetiro: false, categorias: [], sinCategoria: [] };

  const [cats, prods, entrega] = await Promise.all([
    supabase
      .from("categorias")
      .select(COLUMNAS_CATEGORIA)
      .eq("negocio_id", negocio.id)
      .order("orden")
      .returns<Categoria[]>(),
    supabase
      .from("productos")
      .select(COLUMNAS_PRODUCTO)
      .eq("negocio_id", negocio.id)
      .order("orden")
      .returns<Producto[]>(),
    // Solo esta columna de la configuración del asistente es pública (0012).
    supabase.from("agente_config").select("delivery_modo").eq("negocio_id", negocio.id).maybeSingle<{ delivery_modo: string }>(),
  ]);

  if (cats.error) throw new Error(`No se pudieron leer las categorías: ${cats.error.message}`);
  if (prods.error) throw new Error(`No se pudieron leer los productos: ${prods.error.message}`);

  const productos = prods.data.map((p) => ({ ...p, precio_usd: Number(p.precio_usd) }));
  const idsCategorias = new Set(cats.data.map((c) => c.id));

  return {
    negocio: base,
    // Si no se pudo leer, se ofrece domicilio (como siempre): el agente igual valida al recibir el pedido.
    soloRetiro: entrega.data?.delivery_modo === "retiro",
    categorias: cats.data.map((c) => ({
      ...c,
      productos: productos.filter((p) => p.categoria_id === c.id),
    })),
    sinCategoria: productos.filter((p) => !p.categoria_id || !idsCategorias.has(p.categoria_id)),
  };
});
