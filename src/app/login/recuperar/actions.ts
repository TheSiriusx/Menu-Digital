"use server";

import { urlBase } from "@/lib/sitio";
import { crearClienteServidor } from "@/lib/supabase/server";
import { conValidacion, leerCorreo, type Estado } from "@/lib/validacion";

// Paso 1 de «olvidé mi contraseña»: Supabase manda al correo un enlace a /login/recuperar/confirmar.
// El cliente del servidor usa PKCE: guarda en una cookie la mitad secreta del intercambio, así que el
// enlace solo sirve en el mismo navegador donde se pidió.
export async function pedirEnlace(_previo: Estado, datos: FormData): Promise<Estado> {
  return conValidacion(async () => {
    const correo = leerCorreo(datos, "correo");
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${await urlBase()}/login/recuperar/confirmar`,
    });
    if (error?.status === 429) return { error: "Ya pediste varios enlaces. Espera unos minutos e inténtalo de nuevo." };
    // Mensaje único: no revela si el correo tiene cuenta.
    return { ok: "Si ese correo tiene una cuenta, te llegará un enlace en unos minutos. Revisa también el spam." };
  });
}
