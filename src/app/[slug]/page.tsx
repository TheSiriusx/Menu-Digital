import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MenuPedido } from "@/components/menu-pedido";
import { TabsCategorias } from "@/components/tabs-categorias";
import { variablesAcento } from "@/lib/color";
import { estadoLocal } from "@/lib/horario";
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

function Insignia({ nombre, logo }: { nombre: string; logo: string | null }) {
  return logo ? (
    // Los logos se reducen a 256 px al subirlos (ver subir-imagen.tsx).
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logo} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full object-cover" />
  ) : (
    <div
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--acento) font-titulo text-base font-semibold text-(--sobre-acento)"
    >
      {iniciales(nombre)}
    </div>
  );
}

// «Panadería Nueva Victoria» -> «NV» (sin palabras genéricas del rubro).
function iniciales(nombre: string): string {
  const palabras = nombre.split(/\s+/).filter((p) => p && !/^(panader[ií]a|pasteler[ií]a|caf[eé]|la|el|los|las|de|del)$/i.test(p));
  return (palabras.length ? palabras : nombre.split(/\s+/)).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
}

export default async function MenuPage({ params }: Props) {
  const { slug } = await params;
  const menu = await getMenuBySlug(slug);
  if (!menu) notFound();

  const { negocio, categorias, sinCategoria } = menu;
  const estilo = variablesAcento(negocio.color) as CSSProperties;

  if (!negocio.activo) {
    return (
      <main style={estilo} className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
        <Insignia nombre={negocio.nombre} logo={negocio.logo_url} />
        <h1 className="text-2xl leading-tight">{negocio.nombre}</h1>
        <p className="max-w-xs text-muted">Menú temporalmente no disponible. Vuelve a intentarlo más tarde.</p>
      </main>
    );
  }

  const categoriasConProductos = categorias.filter((c) => c.productos.length > 0);
  const estado = menu.horario ? estadoLocal(menu.horario) : null;

  return (
    <div style={estilo} className="mx-auto w-full max-w-xl flex-1">
      <header className="px-5 pt-7 pb-3.5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[22px] leading-tight">{negocio.nombre}</h1>
            {estado ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted">
                <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${estado.abierto ? "bg-exito" : "bg-muted"}`} />
                {estado.texto}
              </p>
            ) : (
              negocio.horario && <p className="mt-1.5 text-[13px] text-muted">{negocio.horario}</p>
            )}
          </div>
          <Insignia nombre={negocio.nombre} logo={negocio.logo_url} />
        </div>
        {negocio.tasa_bs > 0 && (
          <p className="mt-3 text-xs text-muted tabular-nums">Tasa del día: {formatBs(negocio.tasa_bs)} por $1</p>
        )}
      </header>

      {categoriasConProductos.length > 1 && (
        <TabsCategorias categorias={categoriasConProductos.map((c) => ({ id: c.id, nombre: c.nombre }))} />
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
