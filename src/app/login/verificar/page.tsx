import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verificarCodigo } from "@/app/login/verificar/actions";
import { estiloCampo } from "@/components/admin/estilos";
import { Boton, FormAccion } from "@/components/admin/ui";
import { obtenerSesion } from "@/lib/admin";
import { estadoMfa } from "@/lib/mfa";
import { MarcoAcceso } from "@/app/login/marco";

export const metadata: Metadata = { title: "Verificación — Panel", robots: { index: false } };

export default async function Verificar() {
  const { user } = await obtenerSesion();
  if (!user) redirect("/login");
  const mfa = await estadoMfa();
  if (mfa.nivel === "aal2" || !mfa.tieneFactor) redirect("/admin");

  return (
    <MarcoAcceso titulo="Verificación en dos pasos" descripcion="Escribe el código de 6 dígitos de tu app autenticadora.">
      <FormAccion accion={verificarCodigo} className="space-y-4">
        <label className="block text-sm font-medium">
          Código
          <input
            name="codigo"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            autoFocus
            className={`mt-1 ${estiloCampo} text-center text-xl tracking-[0.4em] tabular-nums`}
          />
        </label>
        <Boton className="w-full py-3">Verificar</Boton>
      </FormAccion>
    </MarcoAcceso>
  );
}
