"use server";

import { redirect } from "next/navigation";
import { requerirSuperadminSinMfa } from "@/lib/admin";
import { limpiarCodigo, type EstadoInscripcion } from "@/lib/mfa";
import type { Estado } from "@/lib/validacion";

// Paso 1: crea el factor (todavía sin verificar) y devuelve el QR y el código secreto de respaldo.
export async function iniciarInscripcion(): Promise<EstadoInscripcion> {
  const { supabase } = await requerirSuperadminSinMfa();

  // Restos de un intento anterior a medias (sin verificar) se limpian: Supabase no admite dos con el mismo nombre.
  const { data: factores } = await supabase.auth.mfa.listFactors();
  for (const f of factores?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Super admin ${new Date().toISOString().slice(0, 19)}`,
  });
  if (error || !data) return { error: "No se pudo iniciar la inscripción. Inténtalo de nuevo." };

  return { factorId: data.id, qr: data.totp.qr_code, secreto: data.totp.secret };
}

// Paso 2: comprueba el primer código. Si es correcto, la sesión sube a "aal2" y el factor queda activo.
export async function confirmarInscripcion(_previo: Estado, datos: FormData): Promise<Estado> {
  const { supabase } = await requerirSuperadminSinMfa();
  const codigo = limpiarCodigo(datos.get("codigo"));
  const factorId = String(datos.get("factorId") ?? "");
  if (!codigo) return { error: "Escribe los 6 dígitos que muestra tu app." };
  if (!/^[0-9a-f-]{36}$/i.test(factorId)) return { error: "Solicitud no válida. Empieza de nuevo." };

  const { data: desafio, error: errorDesafio } = await supabase.auth.mfa.challenge({ factorId });
  if (errorDesafio || !desafio) return { error: "No se pudo iniciar la verificación. Empieza de nuevo." };

  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: desafio.id, code: codigo });
  if (error) return { error: "Código incorrecto o vencido. Espera al siguiente código e inténtalo de nuevo." };

  redirect("/superadmin");
}
