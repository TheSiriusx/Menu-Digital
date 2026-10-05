"use server";

import { createClient } from "@supabase/supabase-js";
import { MAX_POR_PRODUCTO } from "@/lib/pedido";

type Linea = { producto: string; cantidad: number };

// Guarda el carrito del menú y devuelve el código corto que va al final del mensaje de WhatsApp
// (ver supabase/migrations/0013_pedido_web.sql). Va sin sesión, con la clave pública: la función de la base
// valida productos, cantidades y topes. Si algo falla devuelve null y el menú manda el bloque largo de siempre.
export async function guardarPedidoWeb(slug: string, lineas: Linea[], entrega: "retiro" | "domicilio"): Promise<string | null> {
  if (typeof slug !== "string" || !/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  if (entrega !== "retiro" && entrega !== "domicilio") return null;
  if (!Array.isArray(lineas) || lineas.length < 1 || lineas.length > 50) return null;
  const items = lineas.map((l) => ({ producto: String(l?.producto ?? ""), cantidad: Math.trunc(Number(l?.cantidad)) }));
  if (items.some((i) => !/^[0-9a-f-]{36}$/.test(i.producto) || !(i.cantidad >= 1 && i.cantidad <= MAX_POR_PRODUCTO))) return null;

  // Cliente propio y sin caché: el de src/lib/supabase.ts guarda respuestas 60 s (sirve para leer el menú,
  // no para esto: cada pedido es distinto y debe llegar a la base).
  const cliente = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  try {
    const { data, error } = await cliente.rpc("guardar_pedido_web", { p_negocio: slug, p_items: items, p_entrega: entrega });
    return !error && typeof data === "string" && /^[2-9A-HJKMNP-Z]{6}$/.test(data) ? data : null;
  } catch {
    return null;
  }
}
