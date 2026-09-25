import { PaginaClientes, type Params } from "@/components/admin/paginas";
import { cargarPanelDueno } from "@/lib/admin";

export const metadata = { title: "Panel — Clientes" };

export default async function PanelClientes({ searchParams }: { searchParams: Promise<Params> }) {
  const panel = await cargarPanelDueno();
  return <PaginaClientes panel={panel} contexto={{ superadmin: false, base: "/admin" }} params={await searchParams} />;
}
