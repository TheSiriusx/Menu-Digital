import type { Metadata } from "next";
import { InscribirMfa } from "@/components/admin/inscribir-mfa";
import { EncabezadoPagina, tarjetaSa } from "@/components/superadmin/marco";
import { requerirSuperadminSinMfa } from "@/lib/admin";
import { estadoMfa } from "@/lib/mfa";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Super admin — Seguridad", robots: { index: false } };

export default async function Seguridad() {
  await requerirSuperadminSinMfa();
  const mfa = await estadoMfa();

  // Con factor inscrito pero sin verificar en esta sesión, primero se verifica.
  if (mfa.tieneFactor && mfa.nivel !== "aal2") redirect("/login/verificar");

  return (
    <>
      <EncabezadoPagina
        titulo="Seguridad"
        descripcion="Tu cuenta controla todos los locales. Con la verificación en dos pasos, aunque alguien conozca tu contraseña necesita además el código de tu celular."
      />
      <main className="max-w-2xl space-y-6">
        <h2 className="text-[16px] font-semibold">Verificación en dos pasos</h2>
        {mfa.tieneFactor ? (
          <p role="status" className={`${tarjetaSa} flex items-center gap-3 p-4 text-sm`}>
            <span className="rounded-full bg-exito-suave px-2.5 py-1 text-xs font-semibold text-exito">Activada</span>
            Al entrar se te pedirá el código de tu app autenticadora.
          </p>
        ) : (
          <div className={`${tarjetaSa} p-5`}>
            <InscribirMfa />
          </div>
        )}
      </main>
    </>
  );
}
