import type { CSSProperties, ReactNode } from "react";
import { cerrarSesion } from "@/app/admin/actions";
import { NavPanel, type PestanaPanel } from "@/components/admin/nav-panel";
import { variablesAcento } from "@/lib/color";
import { EMPRESA, MARCA } from "@/lib/marca";

// Armazón del panel (dueño y super admin): barra lateral blanca con la marca, las pestañas y el estado;
// en el celular, la barra va arriba y las pestañas en fila. El contenido va sobre el fondo cálido del panel.
export function Cascaron({
  marca,
  etiqueta,
  pestanas,
  pie,
  color,
  children,
}: {
  marca: { nombre: string; subtitulo: string; logo?: string | null };
  etiqueta: string;
  pestanas: PestanaPanel[];
  pie?: ReactNode;
  color?: string | null;
  children: ReactNode;
}) {
  return (
    <div style={variablesAcento(color ?? null) as CSSProperties} className="flex min-h-dvh flex-1 flex-col bg-panel lg:flex-row">
      <aside className="shrink-0 border-b border-line bg-card px-4 pt-4 pb-2 print:hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[236px] lg:flex-col lg:gap-7 lg:border-r lg:border-b-0 lg:px-[18px] lg:py-[26px]">
        <header className="mb-3 flex items-center gap-2.5 print:hidden lg:mb-0 lg:px-1.5">
          {marca.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={marca.logo} alt="" className="h-9 w-9 shrink-0 rounded-[10px] object-cover" />
          ) : (
            <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-(--acento) font-titulo text-[15px] font-semibold text-(--sobre-acento)">
              {iniciales(marca.nombre)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 font-titulo text-[14.5px] font-semibold leading-tight">{marca.nombre}</p>
            <p className="text-[11.5px] text-muted">{marca.subtitulo}</p>
          </div>
          <form action={cerrarSesion}>
            <button type="submit" className="rounded-[8px] border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-surface hover:text-foreground">
              Salir
            </button>
          </form>
        </header>
        <NavPanel etiqueta={etiqueta} pestanas={pestanas} />
        {pie && <div className="mt-auto hidden lg:block">{pie}</div>}
      </aside>
      <div className="min-w-0 flex-1 px-4 pt-6 pb-16 lg:px-10 lg:pt-9">
        <div className="mx-auto max-w-[1180px]">{children}</div>
        <footer className="mx-auto mt-14 max-w-[1180px] text-center text-xs text-muted print:hidden">
          <span className="font-titulo font-semibold text-foreground">{MARCA}</span> by {EMPRESA}
        </footer>
      </div>
    </div>
  );
}

// «Panadería Nueva Victoria» -> «NV».
export function iniciales(nombre: string): string {
  const palabras = nombre.split(/\s+/).filter((p) => p && !/^(panader[ií]a|pasteler[ií]a|caf[eé]|la|el|los|las|de|del)$/i.test(p));
  return (palabras.length ? palabras : nombre.split(/\s+/)).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
}

// Recuadro de estado al pie de la barra lateral.
export function EstadoMenu({ activo }: { activo: boolean }) {
  return (
    <div className="rounded-xl bg-panel p-3">
      <p className="flex items-center gap-[7px] text-[12.5px] font-semibold">
        <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${activo ? "bg-exito" : "bg-aviso"}`} />
        {activo ? "Menú activo" : "Menú pausado"}
      </p>
      <p className="mt-1 text-[11.5px] text-muted">{activo ? "Tus clientes lo están viendo" : `Contacta a ${EMPRESA}`}</p>
    </div>
  );
}

// Pestañas de un local dentro del super admin (en fila, sobre el contenido).
export function MarcoPanel({ etiqueta, pestanas, children }: { etiqueta: string; pestanas: PestanaPanel[]; children: ReactNode }) {
  return (
    <>
      <div className="mb-6 rounded-2xl border border-line bg-card px-4 py-2 print:hidden">
        <NavPanel etiqueta={etiqueta} pestanas={pestanas} orientacion="horizontal" />
      </div>
      {children}
    </>
  );
}

export function pestanasDe(base: string, slug: string | null): PestanaPanel[] {
  return [
    { href: base, texto: "Dashboard", icono: "dashboard", exacto: true },
    { href: `${base}/menu`, texto: "Editar menú", icono: "menu" },
    { href: `${base}/pedidos`, texto: "Pedidos", icono: "pedidos" },
    { href: `${base}/clientes`, texto: "Clientes", icono: "clientes" },
    { href: `${base}/configuracion`, texto: "Configuración", icono: "configuracion" },
    ...(slug ? [{ href: `/${slug}`, texto: "Ver mi menú ↗", icono: "externo" as const, nuevaPestana: true }] : []),
  ];
}
