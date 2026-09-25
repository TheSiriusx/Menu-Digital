import type { Metadata } from "next";
import { cerrarSesion } from "@/app/admin/actions";
import { NavTabs } from "@/components/admin/nav-tabs";
import { Boton } from "@/components/admin/ui";
import { obtenerSesion } from "@/lib/admin";

export const metadata: Metadata = { title: "Super admin", robots: { index: false, follow: false } };


// Solo el marco. Cada página y cada acción comprueban el rol por su cuenta.
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const { rol } = await obtenerSesion();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
      <header className="flex flex-wrap items-center gap-2 py-4 print:hidden">
        {rol === "superadmin" && (
          <NavTabs
            etiqueta="Super admin"
            pestanas={[
              { href: "/superadmin", texto: "Locales", exacto: true },
              { href: "/superadmin/cuenta", texto: "Mi cuenta" },
              { href: "/superadmin/mfa", texto: "Seguridad" },
            ]}
          />
        )}
        <form action={cerrarSesion} className="ml-auto">
          <Boton variante="suave">Salir</Boton>
        </form>
      </header>
      {children}
    </div>
  );
}
