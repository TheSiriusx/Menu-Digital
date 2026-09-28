import type { Metadata } from "next";
import { Cascaron, EstadoMenu, pestanasDe } from "@/components/admin/marco-panel";
import { etiquetaTipo } from "@/lib/tipos";
import { obtenerSesion } from "@/lib/admin";

export const metadata: Metadata = { title: "Panel", robots: { index: false, follow: false } };


// Este layout solo pinta el marco. La comprobación de sesión real la hace cada página y cada
// acción (los layouts no se vuelven a ejecutar al navegar entre páginas).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { supabase, negocioId } = await obtenerSesion();

  type Marca = { slug: string; nombre: string; tipo: string; logo_url: string | null; color: string | null; activo: boolean };
  let negocio: Marca | null = null;
  if (negocioId) {
    const { data } = await supabase.from("negocios").select("slug, nombre, tipo, logo_url, color, activo").eq("id", negocioId).single();
    negocio = (data as Marca | null) ?? null;
  }

  if (!negocioId || !negocio) return <div className="flex flex-1 flex-col bg-panel px-4">{children}</div>;

  return (
    <Cascaron
      marca={{ nombre: negocio.nombre, subtitulo: etiquetaTipo(negocio.tipo), logo: negocio.logo_url }}
      color={negocio.color}
      etiqueta="Panel"
      pestanas={pestanasDe("/admin", negocio.slug)}
      pie={<EstadoMenu activo={negocio.activo} />}
    >
      {children}
    </Cascaron>
  );
}
