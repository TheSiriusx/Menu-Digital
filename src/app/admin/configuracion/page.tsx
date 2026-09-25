import { PaginaConfiguracion } from "@/components/admin/paginas";
import { cargarPanelDueno } from "@/lib/admin";

export const metadata = { title: "Panel — Configuración" };

export default async function PanelConfiguracion() {
  const panel = await cargarPanelDueno();
  return <PaginaConfiguracion panel={panel} contexto={{ superadmin: false, base: "/admin" }} />;
}
