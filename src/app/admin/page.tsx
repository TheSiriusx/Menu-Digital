import { VistaProductos } from "@/components/admin/vistas";
import { cargarPanelDueno } from "@/lib/admin";

export default async function PanelProductos() {
  const panel = await cargarPanelDueno();
  return <VistaProductos panel={panel} contexto={{ superadmin: false }} />;
}
