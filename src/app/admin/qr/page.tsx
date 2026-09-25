import { VistaQR } from "@/components/admin/vista-qr";
import { cargarPanelDueno } from "@/lib/admin";

export const metadata = { title: "Panel — QR" };

export default async function PanelQR() {
  const { negocio } = await cargarPanelDueno();
  return <VistaQR nombre={negocio.nombre} slug={negocio.slug} />;
}
