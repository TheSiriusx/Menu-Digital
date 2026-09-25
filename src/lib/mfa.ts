import { cache } from "react";
import { obtenerSesion } from "@/lib/admin";

// Estado de la verificación en dos pasos (MFA por app autenticadora) de la sesión actual.
//   nivel "aal1" = entró solo con contraseña; "aal2" = además verificó el código de 6 dígitos.
// El nivel se lee con getClaims(), que comprueba la firma del token (no se fía de la cookie tal cual).
// Esto es una comodidad de la interfaz: quien de verdad exige "aal2" para las acciones de super admin
// es la base de datos (es_superadmin(), migración 0006).
export const estadoMfa = cache(async () => {
  const { supabase } = await obtenerSesion();
  const [claims, factores] = await Promise.all([supabase.auth.getClaims(), supabase.auth.mfa.listFactors()]);

  const nivel = (claims.data?.claims?.aal as "aal1" | "aal2" | undefined) ?? null;
  // `totp` solo trae los factores ya verificados (los que se dejaron a medias no cuentan).
  const verificado = factores.data?.totp?.[0] ?? null;
  return { nivel, tieneFactor: !!verificado, factorId: verificado?.id ?? null };
});

// Lo que devuelve el primer paso de la inscripción.
export type EstadoInscripcion = {
  error?: string;
  ok?: string;
  factorId?: string;
  qr?: string;
  secreto?: string;
};

// Acepta "123 456" y "123456".
export function limpiarCodigo(bruto: FormDataEntryValue | null): string | null {
  const codigo = String(bruto ?? "").replace(/\s+/g, "");
  return /^\d{6}$/.test(codigo) ? codigo : null;
}
