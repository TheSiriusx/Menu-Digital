import type { Metadata } from "next";
import { Cascaron } from "@/components/admin/marco-panel";
import { obtenerSesion } from "@/lib/admin";
import { MARCA } from "@/lib/marca";

export const metadata: Metadata = { title: "Super admin", robots: { index: false, follow: false } };


// Solo el marco. Cada página y cada acción comprueban el rol por su cuenta.
export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const { rol } = await obtenerSesion();
  if (rol !== "superadmin") return <div className="flex flex-1 flex-col bg-panel px-4">{children}</div>;

  return (
    <Cascaron
      marca={{ nombre: MARCA, subtitulo: "Super admin" }}
      etiqueta="Super admin"
      pestanas={[
        { href: "/superadmin", texto: "Locales", icono: "locales", exacto: true },
        { href: "/superadmin/cuenta", texto: "Mi cuenta", icono: "cuenta" },
        { href: "/superadmin/mfa", texto: "Seguridad", icono: "seguridad" },
      ]}
    >
      {children}
    </Cascaron>
  );
}
