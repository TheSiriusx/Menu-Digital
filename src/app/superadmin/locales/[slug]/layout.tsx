import Link from "next/link";
import { iniciales, MarcoPanel, pestanasDe } from "@/components/admin/marco-panel";
import { Icono } from "@/components/iconos";
import { tarjetaSa } from "@/components/superadmin/marco";
import { cargarLocalPorSlug } from "@/lib/admin";
import { etiquetaTipo } from "@/lib/tipos";

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
      <div className={`${tarjetaSa} mb-5 flex flex-wrap items-center gap-4 p-4 print:hidden lg:p-5`}>
        {local.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={local.logo_url} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl border border-line object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-(--acento-suave) font-titulo font-bold text-(--acento-texto)">
            {iniciales(local.nombre)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Administrando:</p>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="font-titulo text-[18px] font-semibold">{local.nombre}</strong>
            <span className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted">{etiquetaTipo(local.tipo)}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${local.activo ? "bg-exito-suave text-exito" : "bg-aviso-suave text-aviso"}`}>
              {local.activo ? "activo" : "pausado"}
            </span>
          </div>
        </div>
        <Link href="/superadmin" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-muted hover:bg-surface hover:text-foreground">
          <Icono nombre="chevron" tamano={16} className="rotate-180" />
          Todos los locales
        </Link>
      </div>
      <MarcoPanel etiqueta="Local" pestanas={pestanasDe(base, local.slug)}>
        {children}
      </MarcoPanel>
    </>
  );
}
