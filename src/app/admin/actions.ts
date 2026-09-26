"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requerirNegocio, requerirUsuario } from "@/lib/admin";
import { DIAS, NOMBRE_DIA, type Horario } from "@/lib/asistente";
import { esEstado, ETIQUETA_ESTADO } from "@/lib/pedidos-estados";
import { BUCKET, detectarFormato, MAX_BYTES_IMAGEN, MIME, rutaDesdeUrl, urlPublica } from "@/lib/imagenes";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  conValidacion,
  ErrorValidacion,
  leerColor,
  leerEntero,
  leerHora,
  leerId,
  leerIdOpcional,
  leerPrecioUsd,
  leerStock,
  leerTasaBs,
  leerTelefono,
  leerTexto,
  leerTextoLargo,
  leerOpcion,
  leerUrlHttps,
  leerUsdOpcional,
  marcado,
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

// ---------------------------------------------------------------- stock, categorías visibles y pedidos

export async function actualizarStock(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase, negocioId } = await requerirNegocio(datos);
    const id = leerId(datos, "id");
    const stock = leerStock(datos, "stock");
    const { data, error } = await supabase
      .from("productos")
      .update({ stock })
      .eq("id", id)
      .eq("negocio_id", negocioId)
      .select("id");
    if (error) fallo("No se pudo guardar el stock", error);
    if (!data?.length) throw new ErrorValidacion("No se encontró el producto.");
    publicar();
    return { ok: stock === null ? "Sin control de stock." : `Stock guardado: ${stock}.` };
  });
}

export async function alternarCategoria(datos: FormData) {
  const { supabase, negocioId } = await requerirNegocio(datos);
  const id = leerId(datos, "id");
  const activa = String(datos.get("activa")) === "true";
  const { error } = await supabase.from("categorias").update({ activa }).eq("id", id).eq("negocio_id", negocioId);
  if (error) fallo("No se pudo cambiar la visibilidad de la categoría", error);
  publicar();
}

// Cambia el estado de un pedido con la función de la base de datos (la misma máquina de estados que usa el
// agente). Cancelar devuelve el stock. La base de datos decide quién puede: un dueño con el local pausado no.
export async function cambiarEstadoPedido(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase, negocioId } = await requerirNegocio(datos);
    const id = leerId(datos, "id");
    const nuevo = String(datos.get("estado"));
    if (!esEstado(nuevo)) throw new ErrorValidacion("Estado no válido.");

    const { data: pedido } = await supabase.from("pedidos").select("id").eq("id", id).eq("negocio_id", negocioId).maybeSingle();
    if (!pedido) throw new ErrorValidacion("No se encontró el pedido.");

    const { error } = await supabase.rpc("cambiar_estado_pedido", { p_pedido: id, p_estado: nuevo });
    if (error) {
      if (error.code === "42501") throw new ErrorValidacion("Tu local está pausado: no puedes cambiar pedidos hasta ponerte al día.");
      if (error.code === "22023") throw new ErrorValidacion("Ese cambio de estado no está permitido.");
      if (error.code === "P0002") throw new ErrorValidacion("No se encontró el pedido.");
      fallo("No se pudo cambiar el estado del pedido", error);
    }
    publicar();
    return { ok: `Pedido ${ETIQUETA_ESTADO[nuevo].toLowerCase()}.` };
  });
}

// ---------------------------------------------------------------- asistente de WhatsApp (agente_config, 0011)

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? "").trim();

function leerHorario(datos: FormData): Horario {
  const horario: Horario = {};
  for (const d of DIAS) {
    const dia = NOMBRE_DIA[d];
    if (marcado(datos, `cerrado_${d}`)) {
      horario[d] = [];
      continue;
    }
    const t1 = { desde: leerHora(datos, `desde_${d}`, dia), hasta: leerHora(datos, `hasta_${d}`, dia) };
    if (t1.desde >= t1.hasta) throw new ErrorValidacion(`${dia}: la hora de cierre debe ser después de la de apertura.`);
    const tramos = [t1];
    if (texto(datos, `desde2_${d}`) || texto(datos, `hasta2_${d}`)) {
      const t2 = { desde: leerHora(datos, `desde2_${d}`, dia), hasta: leerHora(datos, `hasta2_${d}`, dia) };
      if (t2.desde >= t2.hasta || t2.desde < t1.hasta) {
        throw new ErrorValidacion(`${dia}: el segundo horario debe empezar después de que termine el primero.`);
      }
      tramos.push(t2);
    }
    horario[d] = tramos;
  }
  return horario;
}

function refrescarPanel() {
  revalidatePath("/admin", "layout");
  revalidatePath("/superadmin", "layout");
}

// Guarda una sección de la configuración del asistente. Cada tarjeta del panel manda solo sus campos.
export async function actualizarAsistente(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const { supabase, negocioId } = await requerirNegocio(datos);
    let cambios: Record<string, unknown>;
    switch (texto(datos, "seccion")) {
      case "horario":
        cambios = { horario: leerHorario(datos), acepta_fuera_horario: marcado(datos, "acepta_fuera_horario") };
        break;
      case "pagos":
        cambios = {
          datos_pago: leerTextoLargo(datos, "datos_pago", "Los datos de pago", 600),
          pago_momento: leerOpcion(datos, "pago_momento", ["al_registrar", "al_confirmar"] as const, "cuándo enviar los datos de pago"),
        };
        break;
      case "entregas": {
        const modo = leerOpcion(datos, "delivery_modo", ["retiro", "cotizado", "tarifa"] as const, "cómo entregas los pedidos");
        const tarifa = leerUsdOpcional(datos, "delivery_tarifa_usd");
        if (modo === "tarifa" && tarifa === null) throw new ErrorValidacion("Escribe la tarifa del delivery en dólares.");
        if (tarifa !== null && tarifa > 1000) throw new ErrorValidacion("La tarifa del delivery es demasiado alta.");
        cambios = {
          delivery_modo: modo,
          delivery_tarifa_usd: modo === "tarifa" ? tarifa : null,
          delivery_texto: leerTextoLargo(datos, "delivery_texto", "Las condiciones de entrega", 300),
        };
        break;
      }
      case "avisos": {
        const r1 = leerEntero(datos, "recordatorio_1_min", "El primer recordatorio", 1, 240, true);
        const r2 = leerEntero(datos, "recordatorio_2_min", "El segundo recordatorio", 1, 240, true);
        if (r1 !== null && r2 !== null && r2 <= r1) throw new ErrorValidacion("El segundo recordatorio debe ser después del primero.");
        cambios = {
          telefono_dueno: leerTelefono(datos, "telefono_dueno"),
          recordatorio_1_min: r1,
          recordatorio_2_min: r2,
          resena_url: leerUrlHttps(datos, "resena_url", "El enlace de reseñas"),
          resena_espera_min: leerEntero(datos, "resena_espera_min", "La espera antes de pedir la reseña", 10, 2880),
        };
        break;
      }
      case "avanzado": {
        const grande = leerUsdOpcional(datos, "pedido_grande_usd");
        if (grande === null || grande < 1) throw new ErrorValidacion("El monto de pedido grande debe ser de al menos $1.");
        cambios = {
          stock_aviso_umbral: leerEntero(datos, "stock_aviso_umbral", "El aviso de pocas unidades", 0, 100),
          encargo_aviso_horas: leerEntero(datos, "encargo_aviso_horas", "La anticipación de los encargos", 0, 720),
          pedido_grande_usd: grande,
          pedido_grande_unidades: leerEntero(datos, "pedido_grande_unidades", "Las unidades de pedido grande", 1, 999),
        };
        break;
      }
      default:
        throw new ErrorValidacion("Solicitud no válida. Recarga la página e inténtalo de nuevo.");
    }
    const { data, error } = await supabase.from("agente_config").update(cambios).eq("negocio_id", negocioId).select("negocio_id");
    if (error) fallo("No se pudo guardar la configuración del asistente", error);
    if (!data?.length) throw new ErrorValidacion("No se pudo guardar la configuración del asistente.");
    refrescarPanel();
    return { ok: "Guardado." };
  });
}

// Encender o apagar el asistente (también quita una pausa por horas puesta desde WhatsApp).
export async function alternarAsistente(datos: FormData) {
  const { supabase, negocioId } = await requerirNegocio(datos);
  const encender = texto(datos, "encender") === "true";
  const { error } = await supabase
    .from("agente_config")
    .update({ agente_activo: encender, pausado_hasta: null })
    .eq("negocio_id", negocioId);
  if (error) fallo("No se pudo cambiar el estado del asistente", error);
  refrescarPanel();
}
