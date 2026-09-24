import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuPedido } from "@/components/menu-pedido";
import { getMenuBySlug } from "@/lib/menu";
import { formatBs } from "@/lib/precios";

// Los cambios de precio/tasa hechos en la base de datos se ven en la página en ≤ 60 s.
export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

const ACENTO_POR_DEFECTO = "#18181b";
const COLOR_HEX = /^#[0-9a-fA-F]{6}$/;

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

export default async function MenuPage({ params }: Props) {
  const { slug } = await params;
  const menu = await getMenuBySlug(slug);
  if (!menu) notFound();

  const { negocio, categorias, sinCategoria } = menu;
  const acento = negocio.color && COLOR_HEX.test(negocio.color) ? negocio.color : ACENTO_POR_DEFECTO;
  const estilo = { "--acento": acento } as CSSProperties;

  if (!negocio.activo) {
    return (
      <main style={estilo} className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">{negocio.nombre}</h1>
        <p className="max-w-sm text-zinc-600 dark:text-zinc-400">
          Menú temporalmente no disponible. Vuelve a intentarlo más tarde.
        </p>
      </main>
    );
  }

  const categoriasConProductos = categorias.filter((c) => c.productos.length > 0);

  return (
    <div style={estilo} className="mx-auto w-full max-w-2xl flex-1">
      <header className="border-t-4 border-(--acento) px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          {negocio.logo_url && (
            // Los logos llegan en la Fase 5 (Supabase Storage).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={negocio.logo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{negocio.nombre}</h1>
        </div>
        {negocio.horario && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{negocio.horario}</p>
        )}
        {negocio.tasa_bs > 0 && (
          <p className="mt-2 inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            Tasa del día: {formatBs(negocio.tasa_bs)} por $1
          </p>
        )}
      </header>

      {categoriasConProductos.length > 1 && (
        <nav
          aria-label="Categorías"
          className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-zinc-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-zinc-800 dark:bg-black/95"
        >
          {categoriasConProductos.map((c) => (
            <a
              key={c.id}
              href={`#cat-${c.id}`}
              className="shrink-0 rounded-full border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
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
      />
    </div>
  );
}
