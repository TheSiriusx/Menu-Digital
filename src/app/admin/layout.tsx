import type { Metadata } from "next";
import Link from "next/link";
import { cerrarSesion } from "@/app/admin/actions";
import { Boton } from "@/components/admin/ui";
import { obtenerSesion } from "@/lib/admin";

export const metadata: Metadata = { title: "Panel", robots: { index: false, follow: false } };

const enlace = "rounded-full border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700";

// Este layout solo pinta el marco. La comprobación de sesión real la hace cada página y cada
// acción (los layouts no se vuelven a ejecutar al navegar entre páginas).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, negocioId } = await obtenerSesion();

  let slug: string | null = null;
  if (negocioId) {
    const { data } = await supabase.from("negocios").select("slug").eq("id", negocioId).single();
    slug = (data?.slug as string | undefined) ?? null;
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
      <header className="flex flex-wrap items-center gap-2 py-4">
        {negocioId && (
          <nav aria-label="Panel" className="flex flex-1 flex-wrap gap-2">
            <Link href="/admin" className={enlace}>Productos</Link>
            <Link href="/admin/categorias" className={enlace}>Categorías</Link>
            <Link href="/admin/ajustes" className={enlace}>Ajustes</Link>
            {slug && (
              <Link href={`/${slug}`} target="_blank" className={enlace}>Ver mi menú ↗</Link>
            )}
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
