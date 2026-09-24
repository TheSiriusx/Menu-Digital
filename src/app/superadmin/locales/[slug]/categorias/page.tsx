import { VistaCategorias } from "@/components/admin/vistas";
import { cargarLocalPorSlug, cargarPanel } from "@/lib/admin";

export default async function CategoriasDelLocal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const local = await cargarLocalPorSlug(slug);
  const panel = await cargarPanel(local.id);
  return <VistaCategorias panel={panel} contexto={{ superadmin: true }} />;
}
