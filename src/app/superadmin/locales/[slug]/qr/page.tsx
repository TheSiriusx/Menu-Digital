import { VistaQR } from "@/components/admin/vista-qr";
import { cargarLocalPorSlug } from "@/lib/admin";

export default async function QRDelLocal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const local = await cargarLocalPorSlug(slug);
  return <VistaQR nombre={local.nombre} slug={local.slug} />;
}
