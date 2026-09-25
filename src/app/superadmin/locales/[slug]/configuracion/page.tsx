import { PaginaConfiguracion } from "@/components/admin/paginas";
import { cargarLocalPorSlug, cargarPanel } from "@/lib/admin";

export default async function Local({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const local = await cargarLocalPorSlug(slug);
  const panel = await cargarPanel(local.id);
  return <PaginaConfiguracion panel={panel} contexto={{ superadmin: true, base: `/superadmin/locales/${local.slug}` }} />;
}
