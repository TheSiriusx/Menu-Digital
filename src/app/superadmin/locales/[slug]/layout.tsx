import { MarcoPanel, pestanasDe } from "@/components/admin/marco-panel";
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
      <MarcoPanel etiqueta="Local" pestanas={pestanasDe(base, local.slug)}>
        {children}
      </MarcoPanel>
    </>
  );
}
