import { PaginaDashboard, type Params } from "@/components/admin/paginas";
import { cargarPanelDueno } from "@/lib/admin";

export const metadata = { title: "Panel — Dashboard" };

export default async function PanelDashboard({ searchParams }: { searchParams: Promise<Params> }) {
  const panel = await cargarPanelDueno();
  return <PaginaDashboard panel={panel} contexto={{ superadmin: false, base: "/admin" }} params={await searchParams} />;
}
