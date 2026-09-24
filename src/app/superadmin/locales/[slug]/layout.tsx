import Link from "next/link";
import { cargarLocalPorSlug } from "@/lib/admin";

const enlace = "rounded-full border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700";

export default async function LayoutLocal({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const local = await cargarLocalPorSlug(slug);
  const base = `/superadmin/locales/${local.slug}`;

  return (
    <>
      <div className="mb-4 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900">
        Administrando: <strong>{local.nombre}</strong>{" "}
        <span className="text-zinc-500">({local.activo ? "activo" : "pausado"})</span>
      </div>
      <nav aria-label="Local" className="mb-6 flex flex-wrap gap-2">
        <Link href={base} className={enlace}>Productos</Link>
        <Link href={`${base}/categorias`} className={enlace}>Categorías</Link>
        <Link href={`${base}/ajustes`} className={enlace}>Ajustes</Link>
        <Link href={`/${local.slug}`} target="_blank" className={enlace}>Ver menú ↗</Link>
      </nav>
      {children}
    </>
  );
}
