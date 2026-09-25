import { PaginaMenu } from "@/components/admin/paginas";
import { cargarPanelDueno } from "@/lib/admin";

export const metadata = { title: "Panel — Editar menú" };

export default async function PanelMenu() {
  const panel = await cargarPanelDueno();
  return <PaginaMenu panel={panel} contexto={{ superadmin: false, base: "/admin" }} />;
}
