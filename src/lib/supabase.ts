import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example)",
  );
}

// Cliente único con la clave pública. La seguridad real la da RLS en la base de datos.
export const supabase = createClient(url, anonKey, {
  global: {
    // Next no cachea `fetch` por defecto, y menos aún las peticiones con cabecera
    // `authorization` (supabase-js siempre la envía): hay que pedir `force-cache`. Con esto
    // los datos se reutilizan hasta 60 s en vez de consultar la base en cada visita. La
    // etiqueta permite invalidarlos al instante (revalidateTag("menu")) cuando el panel guarde.
    fetch: (input, init) =>
      fetch(input, { ...init, cache: "force-cache", next: { revalidate: 60, tags: ["menu"] } }),
  },
});
