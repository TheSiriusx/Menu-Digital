import { VistaCategorias } from "@/components/admin/vistas";
import { cargarPanelDueno } from "@/lib/admin";

export const metadata = { title: "Panel — Categorías" };

export default async function PanelCategorias() {
  const panel = await cargarPanelDueno();
  return <VistaCategorias panel={panel} contexto={{ superadmin: false }} />;
}
