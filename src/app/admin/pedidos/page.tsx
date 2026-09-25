import { PaginaPedidos, type Params } from "@/components/admin/paginas";
import { cargarPanelDueno } from "@/lib/admin";

export const metadata = { title: "Panel — Pedidos" };

export default async function PanelPedidos({ searchParams }: { searchParams: Promise<Params> }) {
  const panel = await cargarPanelDueno();
  return <PaginaPedidos panel={panel} contexto={{ superadmin: false, base: "/admin" }} params={await searchParams} />;
}
