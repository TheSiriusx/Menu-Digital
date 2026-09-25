import { NavTabs } from "@/components/admin/nav-tabs";
import { cargarLocalPorSlug } from "@/lib/admin";


export default async function LayoutLocal({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const local = await cargarLocalPorSlug(slug);
  const base = `/superadmin/locales/${local.slug}`;

  return (
    <>
      <div className="mb-4 rounded-lg bg-surface p-3 text-sm print:hidden">
        Administrando: <strong>{local.nombre}</strong>{" "}
        <span className="text-muted">({local.activo ? "activo" : "pausado"})</span>
      </div>
      <div className="mb-6 print:hidden">
        <NavTabs
          etiqueta="Local"
          pestanas={[
            { href: base, texto: "Productos", exacto: true },
            { href: `${base}/categorias`, texto: "Categorías" },
            { href: `${base}/ajustes`, texto: "Ajustes" },
            { href: `${base}/qr`, texto: "QR" },
            { href: `/${local.slug}`, texto: "Ver menú ↗", nuevaPestana: true },
          ]}
        />
      </div>
      {children}
    </>
  );
}
