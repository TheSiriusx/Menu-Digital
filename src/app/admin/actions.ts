"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requerirNegocio, requerirUsuario } from "@/lib/admin";
import { BUCKET, detectarFormato, MAX_BYTES_IMAGEN, MIME, rutaDesdeUrl, urlPublica } from "@/lib/imagenes";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  conValidacion,
  ErrorValidacion,
  leerColor,
  leerId,
  leerIdOpcional,
  leerPrecioUsd,
  leerTasaBs,
  leerTelefono,
  leerTexto,
  type Estado,
} from "@/lib/validacion";

// Tras cada cambio: el menú público se actualiza al instante (etiqueta "menu" de src/lib/supabase.ts)
// y el panel vuelve a leer sus datos.
function publicar() {
  updateTag("menu");
  revalidatePath("/admin", "layout");
  revalidatePath("/superadmin", "layout");
}

function fallo(mensaje: string, error: { message: string }): never {
  throw new Error(`${mensaje}: ${error.message}`);
}

type Cliente = Awaited<ReturnType<typeof requerirNegocio>>["supabase"];

// ---------------------------------------------------------------- imágenes (Storage)

// Borrar el archivo viejo nunca debe hacer fallar la operación: como mucho queda un archivo suelto.
async function borrarArchivo(supabase: Cliente, ruta: string | null) {
  if (!ruta) return;
  const { error } = await supabase.storage.from(BUCKET).remove([ruta]);
  if (error) console.error("No se pudo borrar el archivo", ruta, error.message);
}

// Revisa el archivo de verdad (tamaño y formato por los primeros bytes) y lo sube a la carpeta del
// local con un nombre único. Devuelve la ruta y la URL pública.
async function subirImagen(supabase: Cliente, negocioId: string, datos: FormData) {
  const archivo = datos.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) throw new ErrorValidacion("Elige una imagen.");
  if (archivo.size > MAX_BYTES_IMAGEN) {
    throw new ErrorValidacion("La imagen es demasiado pesada. Prueba con otra foto.");
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const formato = detectarFormato(bytes);
  if (!formato) throw new ErrorValidacion("Ese archivo no es una imagen válida (usa JPG, PNG o WebP).");

  const ruta = `${negocioId}/${randomUUID()}.${formato === "jpeg" ? "jpg" : formato}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, bytes, { contentType: MIME[formato], cacheControl: "31536000", upsert: false });
  if (error) fallo("No se pudo subir la imagen", error);
  return { ruta, url: urlPublica(ruta) };
}

export async function subirFotoProducto(datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase, negocioId } = await requerirNegocio(datos);
    const id = leerId(datos, "id");

    const { data: previo } = await supabase
      .from("productos")
      .select("foto_url")
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .maybeSingle();
    if (!previo) throw new ErrorValidacion("No se encontró el producto.");

    const { ruta, url } = await subirImagen(supabase, negocioId, datos);
    const { data, error } = await supabase
      .from("productos")
      .update({ foto_url: url })
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .select("id");
    if (error || !data?.length) {
      await borrarArchivo(supabase, ruta); // no dejar la imagen nueva huérfana
      if (error) fallo("No se pudo guardar la foto", error);
      throw new ErrorValidacion("No se pudo guardar la foto.");
    }
    await borrarArchivo(supabase, rutaDesdeUrl(previo.foto_url as string | null, negocioId));
    publicar();
    return { ok: "Foto guardada." };
  });
}

export async function quitarFotoProducto(datos: FormData) {
  const { supabase, negocioId } = await requerirNegocio(datos);
  const id = leerId(datos, "id");
  const { data: previo } = await supabase
    .from("productos")
    .select("foto_url")
    .eq("id", id)
    .eq("negocio_id", negocioId)
    .maybeSingle();
  const { data, error } = await supabase
    .from("productos")
    .update({ foto_url: null })
    .eq("id", id)
    .eq("negocio_id", negocioId)
    .select("id");
  if (error) fallo("No se pudo quitar la foto", error);
  if (data?.length) await borrarArchivo(supabase, rutaDesdeUrl(previo?.foto_url as string | null, negocioId));
  publicar();
}

export async function subirLogo(datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase, negocioId } = await requerirNegocio(datos);
    const { data: previo } = await supabase.from("negocios").select("logo_url").eq("id", negocioId).maybeSingle();

    const { ruta, url } = await subirImagen(supabase, negocioId, datos);
    const { data, error } = await supabase.from("negocios").update({ logo_url: url }).eq("id", negocioId).select("id");
    if (error || !data?.length) {
      await borrarArchivo(supabase, ruta);
      if (error) fallo("No se pudo guardar el logo", error);
      throw new ErrorValidacion("No se pudo guardar el logo.");
    }
    await borrarArchivo(supabase, rutaDesdeUrl(previo?.logo_url as string | null, negocioId));
    publicar();
    return { ok: "Logo guardado." };
  });
}

export async function quitarLogo(datos: FormData) {
  const { supabase, negocioId } = await requerirNegocio(datos);
  const { data: previo } = await supabase.from("negocios").select("logo_url").eq("id", negocioId).maybeSingle();
  const { data, error } = await supabase.from("negocios").update({ logo_url: null }).eq("id", negocioId).select("id");
  if (error) fallo("No se pudo quitar el logo", error);
  if (data?.length) await borrarArchivo(supabase, rutaDesdeUrl(previo?.logo_url as string | null, negocioId));
  publicar();
}
type FilaOrden = { id: string; orden: number };

// Intercambia la posición de una fila con su vecina dentro de su grupo. Las posiciones son
// 1..n (como en el seed); solo se escriben las filas cuya posición cambia.
async function intercambiar(
  supabase: Cliente,
  tabla: "productos" | "categorias",
  grupo: FilaOrden[],
  id: string,
  direccion: string,
) {
  const i = grupo.findIndex((f) => f.id === id);
  const j = direccion === "arriba" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= grupo.length) return;

  const nuevo = grupo.map((_, k) => k + 1);
  [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];

  for (let k = 0; k < grupo.length; k++) {
    if (grupo[k].orden === nuevo[k]) continue;
    const { error } = await supabase.from(tabla).update({ orden: nuevo[k] }).eq("id", grupo[k].id);
    if (error) fallo("No se pudo reordenar", error);
  }
}

// ---------------------------------------------------------------- sesión

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function cambiarClave(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const supabase = await requerirUsuario();
    const clave = String(datos.get("clave") ?? "");
    const repetir = String(datos.get("repetir") ?? "");
    if (clave.length < 10) throw new ErrorValidacion("La contraseña debe tener al menos 10 caracteres.");
    if (clave.length > 72) throw new ErrorValidacion("La contraseña no puede pasar de 72 caracteres.");
    if (clave !== repetir) throw new ErrorValidacion("Las dos contraseñas no coinciden.");

    const { error } = await supabase.auth.updateUser({ password: clave });
    if (error) {
      if (error.code === "same_password") throw new ErrorValidacion("La nueva contraseña debe ser distinta de la actual.");
      if (error.code === "weak_password") throw new ErrorValidacion("Esa contraseña es demasiado fácil de adivinar. Elige otra.");
      throw new ErrorValidacion("No se pudo cambiar la contraseña. Inténtalo de nuevo.");
    }
    return { ok: "Contraseña actualizada." };
  });
}

// ---------------------------------------------------------------- negocio

export async function actualizarTasa(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase, negocioId } = await requerirNegocio(datos);
    const tasa = leerTasaBs(datos, "tasa");
    const { data, error } = await supabase.from("negocios").update({ tasa_bs: tasa }).eq("id", negocioId).select("id");
    if (error) fallo("No se pudo guardar la tasa", error);
    if (!data?.length) throw new ErrorValidacion("No se pudo guardar la tasa.");
    publicar();
    return { ok: "Tasa guardada." };
  });
}

export async function actualizarAjustes(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase, negocioId } = await requerirNegocio(datos);
    const cambios = {
      nombre: leerTexto(datos, "nombre", "El nombre", 80, { requerido: true }),
      telefono_whatsapp: leerTelefono(datos, "telefono"),
      horario: leerTexto(datos, "horario", "El horario", 200) || null,
      color: leerColor(datos, "color"),
    };
    const { data, error } = await supabase.from("negocios").update(cambios).eq("id", negocioId).select("id");
    if (error) fallo("No se pudieron guardar los ajustes", error);
    if (!data?.length) throw new ErrorValidacion("No se pudieron guardar los ajustes.");
    publicar();
    return { ok: "Ajustes guardados." };
  });
}

// ---------------------------------------------------------------- categorías

export async function crearCategoria(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase, negocioId } = await requerirNegocio(datos);
    const nombre = leerTexto(datos, "nombre", "El nombre", 60, { requerido: true });

    const { data: ultima } = await supabase
      .from("categorias")
      .select("orden")
      .eq("negocio_id", negocioId)
      .order("orden", { ascending: false })
      .limit(1);
    const orden = ((ultima?.[0]?.orden as number | undefined) ?? 0) + 1;

    const { error } = await supabase.from("categorias").insert({ negocio_id: negocioId, nombre, orden });
    if (error) fallo("No se pudo crear la categoría", error);
    publicar();
    return { ok: "Categoría creada." };
  });
}

export async function renombrarCategoria(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase, negocioId } = await requerirNegocio(datos);
    const id = leerId(datos, "id");
    const nombre = leerTexto(datos, "nombre", "El nombre", 60, { requerido: true });
    const { data, error } = await supabase
      .from("categorias")
      .update({ nombre })
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .select("id");
    if (error) fallo("No se pudo renombrar la categoría", error);
    if (!data?.length) throw new ErrorValidacion("No se encontró la categoría.");
    publicar();
    return { ok: "Guardado." };
  });
}

export async function moverCategoria(datos: FormData) {
  const { supabase, negocioId } = await requerirNegocio(datos);
  const id = leerId(datos, "id");
  const { data, error } = await supabase
    .from("categorias")
    .select("id, orden")
    .eq("negocio_id", negocioId)
    .order("orden")
    .order("id");
  if (error) fallo("No se pudieron leer las categorías", error);
  await intercambiar(supabase, "categorias", data as FilaOrden[], id, String(datos.get("direccion")));
  publicar();
}

export async function borrarCategoria(datos: FormData) {
  const { supabase, negocioId } = await requerirNegocio(datos);
  const id = leerId(datos, "id");
  // Los productos de la categoría se conservan, sin categoría (lo hace la clave foránea).
  const { error } = await supabase.from("categorias").delete().eq("id", id).eq("negocio_id", negocioId);
  if (error) fallo("No se pudo borrar la categoría", error);
  publicar();
}

// ---------------------------------------------------------------- productos

export async function crearProducto(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase, negocioId } = await requerirNegocio(datos);
    const nombre = leerTexto(datos, "nombre", "El nombre", 120, { requerido: true });
    const descripcion = leerTexto(datos, "descripcion", "La descripción", 500) || null;
    const precio = leerPrecioUsd(datos, "precio");
    const categoriaId = leerIdOpcional(datos, "categoria");

    let consulta = supabase
      .from("productos")
      .select("orden")
      .eq("negocio_id", negocioId)
      .order("orden", { ascending: false })
      .limit(1);
    consulta = categoriaId ? consulta.eq("categoria_id", categoriaId) : consulta.is("categoria_id", null);
    const { data: ultimo } = await consulta;
    const orden = ((ultimo?.[0]?.orden as number | undefined) ?? 0) + 1;

    const { error } = await supabase.from("productos").insert({
      negocio_id: negocioId,
      categoria_id: categoriaId,
      nombre,
      descripcion,
      precio_usd: precio,
      orden,
    });
    if (error) {
      // 23503: la categoría no existe o es de otro negocio.
      if (error.code === "23503") throw new ErrorValidacion("La categoría elegida no es válida.");
      fallo("No se pudo crear el producto", error);
    }
    publicar();
    return { ok: "Producto agregado." };
  });
}

export async function actualizarProducto(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase, negocioId } = await requerirNegocio(datos);
    const id = leerId(datos, "id");
    const cambios = {
      nombre: leerTexto(datos, "nombre", "El nombre", 120, { requerido: true }),
      descripcion: leerTexto(datos, "descripcion", "La descripción", 500) || null,
      categoria_id: leerIdOpcional(datos, "categoria"),
    };
    const { data, error } = await supabase
      .from("productos")
      .update(cambios)
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .select("id");
    if (error) {
      if (error.code === "23503") throw new ErrorValidacion("La categoría elegida no es válida.");
      fallo("No se pudo guardar el producto", error);
    }
    if (!data?.length) throw new ErrorValidacion("No se encontró el producto.");
    publicar();
    return { ok: "Guardado." };
  });
}

export async function actualizarPrecio(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase, negocioId } = await requerirNegocio(datos);
    const id = leerId(datos, "id");
    const precio = leerPrecioUsd(datos, "precio");
    const { data, error } = await supabase
      .from("productos")
      .update({ precio_usd: precio })
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .select("id");
    if (error) fallo("No se pudo guardar el precio", error);
    if (!data?.length) throw new ErrorValidacion("No se encontró el producto.");
    publicar();
    return { ok: "Precio guardado." };
  });
}

export async function alternarDisponible(datos: FormData) {
  const { supabase, negocioId } = await requerirNegocio(datos);
  const id = leerId(datos, "id");
  const disponible = String(datos.get("disponible")) === "true";
  const { error } = await supabase
    .from("productos")
    .update({ disponible })
    .eq("id", id)
    .eq("negocio_id", negocioId);
  if (error) fallo("No se pudo cambiar la disponibilidad", error);
  publicar();
}

export async function moverProducto(datos: FormData) {
  const { supabase, negocioId } = await requerirNegocio(datos);
  const id = leerId(datos, "id");

  const { data: producto, error: e1 } = await supabase
    .from("productos")
    .select("categoria_id")
    .eq("id", id)
    .eq("negocio_id", negocioId)
    .maybeSingle();
  if (e1) fallo("No se pudo leer el producto", e1);
  if (!producto) return;

  // Se reordena dentro de su categoría (o dentro de "sin categoría").
  let consulta = supabase.from("productos").select("id, orden").eq("negocio_id", negocioId);
  consulta = producto.categoria_id
    ? consulta.eq("categoria_id", producto.categoria_id)
    : consulta.is("categoria_id", null);
  const { data, error } = await consulta.order("orden").order("id");
  if (error) fallo("No se pudieron leer los productos", error);

  await intercambiar(supabase, "productos", data as FilaOrden[], id, String(datos.get("direccion")));
  publicar();
}

export async function borrarProducto(datos: FormData) {
  const { supabase, negocioId } = await requerirNegocio(datos);
  const id = leerId(datos, "id");
  const { data: previo } = await supabase
    .from("productos")
    .select("foto_url")
    .eq("id", id)
    .eq("negocio_id", negocioId)
    .maybeSingle();
  const { data, error } = await supabase.from("productos").delete().eq("id", id).eq("negocio_id", negocioId).select("id");
  if (error) fallo("No se pudo borrar el producto", error);
  if (data?.length) await borrarArchivo(supabase, rutaDesdeUrl(previo?.foto_url as string | null, negocioId));
  publicar();
}
