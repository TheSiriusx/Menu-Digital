import { PaginaClientes, type Params } from "@/components/admin/paginas";
import { cargarLocalPorSlug, cargarPanel } from "@/lib/admin";

export default async function Local({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Params> }) {
  const { slug } = await params;
  const local = await cargarLocalPorSlug(slug);
  const panel = await cargarPanel(local.id);
  return <PaginaClientes panel={panel} contexto={{ superadmin: true, base: `/superadmin/locales/${local.slug}` }} params={await searchParams} />;
}
