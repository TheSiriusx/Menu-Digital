import { VistaAjustes } from "@/components/admin/vistas";
import { cargarPanelDueno } from "@/lib/admin";

export const metadata = { title: "Panel — Ajustes" };

export default async function PanelAjustes() {
  const panel = await cargarPanelDueno();
  return <VistaAjustes panel={panel} contexto={{ superadmin: false }} />;
}
