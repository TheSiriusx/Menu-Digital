import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { OPCIONES_COOKIE, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/env";

// Cliente del panel: usa la sesión del dueño (cookies httpOnly) y NO cachea nada.
// No confundir con src/lib/supabase.ts, el cliente público del menú, que sí cachea 60 s.
export async function crearClienteServidor() {
  const almacen = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: OPCIONES_COOKIE,
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Desde un Server Component no se pueden escribir cookies: proxy.ts refresca la sesión.
        }
      },
    },
  });
}
