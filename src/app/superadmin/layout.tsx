import type { Metadata } from "next";
import Link from "next/link";
import { cerrarSesion } from "@/app/admin/actions";
import { Boton } from "@/components/admin/ui";
import { obtenerSesion } from "@/lib/admin";

export const metadata: Metadata = { title: "Super admin", robots: { index: false, follow: false } };

const enlace = "rounded-full border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700";

// Solo el marco. Cada página y cada acción comprueban el rol por su cuenta.
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const { rol } = await obtenerSesion();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
      <header className="flex flex-wrap items-center gap-2 py-4 print:hidden">
        {rol === "superadmin" && (
          <nav aria-label="Super admin" className="flex flex-1 flex-wrap gap-2">
            <Link href="/superadmin" className={enlace}>Locales</Link>
            <Link href="/superadmin/cuenta" className={enlace}>Mi cuenta</Link>
          </nav>
        )}
        <form action={cerrarSesion} className="ml-auto">
          <Boton variante="suave">Salir</Boton>
        </form>
      </header>
      {children}
    </div>
  );
}
