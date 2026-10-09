import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { pedirEnlace } from "@/app/login/recuperar/actions";
import { MarcoAcceso } from "@/app/login/marco";
import { estiloCampo } from "@/components/admin/estilos";
import { Boton, FormAccion } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Recuperar contraseña — Panel", robots: { index: false } };

export default async function Recuperar({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // La CSP lleva un nonce distinto por petición: la página debe generarse en cada visita, no en el build.
  await connection();
  const { error } = await searchParams;

  return (
    <MarcoAcceso titulo="Recupera tu contraseña" descripcion="Escribe el correo con el que entras al panel y te mandamos un enlace para crear una nueva.">
      {error === "enlace" && (
        <p role="alert" className="mb-4 rounded-[10px] bg-peligro-suave px-3.5 py-3 text-[13px] font-medium text-peligro">
          El enlace no es válido o ya caducó. Pide uno nuevo y ábrelo en este mismo navegador.
        </p>
      )}
      <FormAccion accion={pedirEnlace} className="space-y-4">
        <label className="block text-sm font-medium">
          Correo
          <input name="correo" type="email" required maxLength={254} autoComplete="username" placeholder="tunegocio@correo.com" className={`mt-1 ${estiloCampo}`} />
        </label>
        <Boton className="w-full py-3">Enviar enlace</Boton>
      </FormAccion>
      <p className="mt-8 text-center text-[13px] text-muted">
        <Link href="/login" className="font-semibold text-foreground underline underline-offset-2">
          Volver a iniciar sesión
        </Link>
      </p>
    </MarcoAcceso>
  );
}
