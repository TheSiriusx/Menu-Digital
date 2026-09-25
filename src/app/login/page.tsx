import type { Metadata } from "next";
import { Boton, FormAccion } from "@/components/admin/ui";
import { estiloCampo } from "@/components/admin/estilos";
import { iniciarSesion } from "@/app/login/actions";

export const metadata: Metadata = { title: "Entrar — Panel", robots: { index: false } };

export default function Login() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Panel del local</h1>
      <p className="mt-1 text-sm text-muted">Entra para editar tu menú.</p>

      <FormAccion accion={iniciarSesion} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Correo
          <input name="correo" type="email" required autoComplete="username" className={`mt-1 ${estiloCampo}`} />
        </label>
        <label className="block text-sm font-medium">
          Contraseña
          <input
            name="clave"
            type="password"
            required
            autoComplete="current-password"
            className={`mt-1 ${estiloCampo}`}
          />
        </label>
        <Boton className="w-full py-3">Entrar</Boton>
      </FormAccion>
    </main>
  );
}
