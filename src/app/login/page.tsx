import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { FormularioAcceso } from "@/app/login/formulario";
import { MarcoAcceso } from "@/app/login/marco";

export const metadata: Metadata = { title: "Iniciar sesión — Panel", robots: { index: false } };

export default async function Login() {
  // La CSP lleva un nonce distinto por petición: la página debe generarse en cada visita, no en el build.
  await connection();
  return (
    <MarcoAcceso titulo="Inicia sesión en tu panel" descripcion="Accede con el correo y la contraseña que te configuramos.">
      <FormularioAcceso />
      <p className="mt-8 text-center text-[13px] text-muted">
        <Link href="/login/recuperar" className="font-semibold text-foreground underline underline-offset-2">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
    </MarcoAcceso>
  );
}
