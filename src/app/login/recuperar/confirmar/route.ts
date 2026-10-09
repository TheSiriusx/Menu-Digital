import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

// Paso 2: aquí llega el enlace del correo. Abre una sesión con él y lleva a elegir la contraseña nueva.
// Acepta las dos formas de enlace de Supabase: ?code= (plantilla por defecto, PKCE) y
// ?token_hash=&type=recovery (si la plantilla del correo se cambia para usar {{ .TokenHash }}).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const supabase = await crearClienteServidor();

  let valido = false;
  if (tokenHash && params.get("type") === "recovery") {
    valido = !(await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })).error;
  } else if (code) {
    valido = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }

  redirect(valido ? "/login/nueva-clave" : "/login/recuperar?error=enlace");
}
