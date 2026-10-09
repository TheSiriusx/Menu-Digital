import type { Metadata } from "next";
import Link from "next/link";
import { elegirClaveNueva } from "@/app/login/nueva-clave/actions";
import { MarcoAcceso } from "@/app/login/marco";
import { estiloCampo } from "@/components/admin/estilos";
import { Boton, FormAccion } from "@/components/admin/ui";
import { obtenerSesion } from "@/lib/admin";
import { estadoMfa } from "@/lib/mfa";

export const metadata: Metadata = { title: "Nueva contraseña — Panel", robots: { index: false } };

export default async function NuevaClave() {
  const { user } = await obtenerSesion();

  if (!user) {
    return (
      <MarcoAcceso titulo="Enlace no válido" descripcion="Este enlace ya se usó o caducó.">
        <Link href="/login/recuperar" className="block rounded-[10px] bg-[#c96a3b] p-[13px] text-center text-[14.5px] font-semibold text-white">
          Pedir un enlace nuevo
        </Link>
      </MarcoAcceso>
    );
  }

  const mfa = await estadoMfa();
  const pedirCodigo = mfa.tieneFactor && mfa.nivel !== "aal2";

  return (
    <MarcoAcceso titulo="Crea tu nueva contraseña" descripcion={`Para ${user.email}. Usa una larga y que no uses en otro sitio.`}>
      <FormAccion accion={elegirClaveNueva} className="space-y-4">
        <label className="block text-sm font-medium">
          Nueva contraseña (mínimo 10 caracteres)
          <input name="clave" type="password" required minLength={10} maxLength={72} autoComplete="new-password" autoFocus className={`mt-1 ${estiloCampo}`} />
        </label>
        <label className="block text-sm font-medium">
          Repite la contraseña
          <input name="repetir" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className={`mt-1 ${estiloCampo}`} />
        </label>
        {pedirCodigo && (
          <label className="block text-sm font-medium">
            Código de tu app autenticadora
            <input
              name="codigo"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              className={`mt-1 ${estiloCampo} text-center text-xl tracking-[0.4em] tabular-nums`}
            />
          </label>
        )}
        <Boton className="w-full py-3">Guardar y entrar</Boton>
      </FormAccion>
    </MarcoAcceso>
  );
}
