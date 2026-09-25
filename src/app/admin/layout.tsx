import type { Metadata } from "next";
import { cerrarSesion } from "@/app/admin/actions";
import { MarcoPanel, pestanasDe } from "@/components/admin/marco-panel";
import { Boton } from "@/components/admin/ui";
import { obtenerSesion } from "@/lib/admin";

export const metadata: Metadata = { title: "Panel", robots: { index: false, follow: false } };


// Este layout solo pinta el marco. La comprobación de sesión real la hace cada página y cada
// acción (los layouts no se vuelven a ejecutar al navegar entre páginas).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, negocioId } = await obtenerSesion();

  let negocio: { slug: string; nombre: string } | null = null;
  if (negocioId) {
    const { data } = await supabase.from("negocios").select("slug, nombre").eq("id", negocioId).single();
    negocio = (data as { slug: string; nombre: string } | null) ?? null;
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16">
      <header className="flex items-center gap-3 py-4 print:hidden">
        {negocio && <p className="min-w-0 truncate text-lg font-semibold tracking-tight">{negocio.nombre}</p>}
        <form action={cerrarSesion} className="ml-auto">
          <Boton variante="suave">Salir</Boton>
        </form>
      </header>
      {negocioId ? (
        <MarcoPanel etiqueta="Panel" pestanas={pestanasDe("/admin", negocio?.slug ?? null)}>
          {children}
        </MarcoPanel>
      ) : (
        children
      )}
    </div>
  );
}
