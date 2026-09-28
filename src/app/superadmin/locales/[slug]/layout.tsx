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
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm print:hidden">
        <span className="text-muted">Administrando:</span>
        <strong className="font-titulo text-base">{local.nombre}</strong>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${local.activo ? "bg-exito-suave text-exito" : "bg-aviso-suave text-aviso"}`}>
          {local.activo ? "activo" : "pausado"}
        </span>
      </div>
      <MarcoPanel etiqueta="Local" pestanas={pestanasDe(base, local.slug)}>
        {children}
      </MarcoPanel>
    </>
  );
}
