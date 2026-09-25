import type { Metadata } from "next";
import { InscribirMfa } from "@/components/admin/inscribir-mfa";
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
    <main className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Verificación en dos pasos</h2>
        <p className="text-sm text-muted">
          Tu cuenta controla todos los locales. Con la verificación en dos pasos, aunque alguien conozca tu
          contraseña necesita además el código de tu celular.
        </p>
      </div>

      {mfa.tieneFactor ? (
        <p role="status" className="rounded-xl border border-line bg-surface p-4 text-sm">
          ✅ Activada. Al entrar se te pedirá el código de tu app autenticadora.
        </p>
      ) : (
        <div className="rounded-2xl border border-line p-4">
          <InscribirMfa />
        </div>
      )}
    </main>
  );
}
