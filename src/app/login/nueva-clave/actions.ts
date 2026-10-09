"use server";

import { redirect } from "next/navigation";
import { guardarClaveNueva, requerirUsuario } from "@/lib/admin";
import { limpiarCodigo } from "@/lib/mfa";
import { conValidacion, ErrorValidacion, type Estado } from "@/lib/validacion";

// Paso 3: la contraseña nueva. Si la cuenta tiene verificación en dos pasos, el enlace del correo no basta:
// se exige también el código, para que quien entre a tu correo no pueda saltarse el segundo factor.
export async function elegirClaveNueva(_previo: Estado, datos: FormData): Promise<Estado> {
  const estado = await conValidacion(async () => {
    const supabase = await requerirUsuario();

    const [{ data: claims }, { data: factores }] = await Promise.all([supabase.auth.getClaims(), supabase.auth.mfa.listFactors()]);
    const factor = factores?.totp?.[0];
    if (factor && claims?.claims?.aal !== "aal2") {
      const codigo = limpiarCodigo(datos.get("codigo"));
      if (!codigo) throw new ErrorValidacion("Escribe los 6 dígitos que muestra tu app autenticadora.");
      const { data: desafio, error: errorDesafio } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (errorDesafio || !desafio) throw new ErrorValidacion("No se pudo iniciar la verificación. Inténtalo de nuevo.");
      const { error } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: desafio.id, code: codigo });
      if (error) throw new ErrorValidacion("Código incorrecto o vencido. Espera al siguiente código e inténtalo de nuevo.");
    }

    await guardarClaveNueva(supabase, datos);
    return {};
  });
  if (estado.error) return estado;
  redirect("/admin");
}
