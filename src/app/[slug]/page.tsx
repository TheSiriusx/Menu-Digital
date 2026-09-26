import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuPedido } from "@/components/menu-pedido";
import { acentoDe } from "@/lib/color";
import { getMenuBySlug } from "@/lib/menu";
import { formatBs } from "@/lib/precios";

// Los cambios de precio/tasa hechos en la base de datos se ven en la página en ≤ 60 s.
export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const menu = await getMenuBySlug(slug);
  if (!menu) return { title: "Menú no encontrado" };

  const { nombre } = menu.negocio;
  const title = `${nombre} — Menú`;
  const description = menu.negocio.activo
    ? `Mira el menú de ${nombre} y haz tu pedido por WhatsApp.`
    : `El menú de ${nombre} no está disponible por ahora.`;

  return { title, description, openGraph: { title, description, type: "website" } };
}

function Inicial({ nombre, className }: { nombre: string; className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center bg-[color-mix(in_oklab,var(--acento)_14%,var(--surface))] font-semibold text-[color-mix(in_oklab,var(--acento)_60%,var(--muted))] ${className}`}
    >
      {nombre.charAt(0).toUpperCase()}
    </div>
  );
}

export default async function MenuPage({ params }: Props) {
  const { slug } = await params;
  const menu = await getMenuBySlug(slug);
  if (!menu) notFound();

  const { negocio, categorias, sinCategoria } = menu;
  const { acento, sobre } = acentoDe(negocio.color);
  const estilo = { "--acento": acento, "--sobre-acento": sobre } as CSSProperties;

  if (!negocio.activo) {
    return (
      <main style={estilo} className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <Inicial nombre={negocio.nombre} className="h-16 w-16 rounded-2xl text-2xl" />
        <h1 className="text-2xl font-semibold tracking-tight">{negocio.nombre}</h1>
        <p className="max-w-xs text-muted">Menú temporalmente no disponible. Vuelve a intentarlo más tarde.</p>
      </main>
    );
  }

  const categoriasConProductos = categorias.filter((c) => c.productos.length > 0);

  return (
    <div style={estilo} className="mx-auto w-full max-w-3xl flex-1">
      <header className="bg-[color-mix(in_oklab,var(--acento)_7%,var(--background))] px-4 pt-10 pb-6 sm:rounded-b-3xl">
        <div className="flex items-center gap-4">
          {negocio.logo_url ? (
            // Los logos se reducen a 256 px al subirlos (ver subir-imagen.tsx).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={negocio.logo_url} alt="" width={64} height={64} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
          ) : (
            <Inicial nombre={negocio.nombre} className="h-16 w-16 rounded-2xl text-2xl" />
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">{negocio.nombre}</h1>
            {negocio.horario && <p className="mt-1 text-sm text-muted">{negocio.horario}</p>}
          </div>
        </div>
        {negocio.tasa_bs > 0 && (
          <p className="mt-4 inline-block rounded-full border border-line bg-background px-3 py-1 text-xs font-medium text-muted tabular-nums">
            Tasa del día: {formatBs(negocio.tasa_bs)} por $1
          </p>
        )}
      </header>

      {categoriasConProductos.length > 1 && (
        <nav
          aria-label="Categorías"
          className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-line bg-background/90 px-4 py-3 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categoriasConProductos.map((c) => (
            <a
              key={c.id}
              href={`#cat-${c.id}`}
              className="shrink-0 rounded-full bg-surface px-4 py-1.5 text-sm font-medium"
            >
              {c.nombre}
            </a>
          ))}
        </nav>
      )}

      <MenuPedido
        negocio={{
          slug: negocio.slug,
          nombre: negocio.nombre,
          telefono_whatsapp: negocio.telefono_whatsapp,
          tasa_bs: negocio.tasa_bs,
        }}
        categorias={categorias}
        sinCategoria={sinCategoria}
        soloRetiro={menu.soloRetiro}
      />
    </div>
  );
}
