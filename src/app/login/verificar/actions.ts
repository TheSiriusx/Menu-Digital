"use server";

import { redirect } from "next/navigation";
import { limpiarCodigo } from "@/lib/mfa";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/lib/validacion";

// Segundo paso del login: el código de 6 dígitos de la app autenticadora.
export async function verificarCodigo(_previo: Estado, datos: FormData): Promise<Estado> {
  const codigo = limpiarCodigo(datos.get("codigo"));
  if (!codigo) return { error: "Escribe los 6 dígitos que muestra tu app." };

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: factores } = await supabase.auth.mfa.listFactors();
  const factor = factores?.totp?.[0];
  if (!factor) redirect("/admin"); // esta cuenta no usa segundo factor

  const { data: desafio, error: errorDesafio } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (errorDesafio || !desafio) return { error: "No se pudo iniciar la verificación. Inténtalo de nuevo." };

  const { error } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: desafio.id, code: codigo });
  // Mensaje único: no se distingue "incorrecto" de "vencido" ni se da pistas.
  if (error) return { error: "Código incorrecto o vencido. Espera al siguiente código e inténtalo de nuevo." };

  redirect("/admin");
}
