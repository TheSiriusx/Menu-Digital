import type { ReactNode } from "react";
import { AvisoInstalar } from "@/components/pwa/aviso-instalar";
import { cerrarSesion } from "@/app/admin/actions";
import { NavPanel, type PestanaPanel } from "@/components/admin/nav-panel";
import { Logo } from "@/components/brand/Logo";
import { EMPRESA, FIRMA } from "@/lib/marca";

// Armazón del panel del dueño, con la identidad de Pidelo (no el color del local): barra lateral surface-200 con el
// imagotipo, el local, las pestañas y el estado; en el celular, la barra va arriba y las pestañas en fila.
export function Cascaron({
  marca,
  etiqueta,
  pestanas,
  pie,
  children,
}: {
  marca: { nombre: string; subtitulo: string; logo?: string | null };
  etiqueta: string;
  pestanas: PestanaPanel[];
  pie?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-surface-100 lg:flex-row">
      <aside className="shrink-0 border-b border-line bg-surface-200 px-4 pt-4 pb-2 print:hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-[236px] lg:flex-col lg:gap-7 lg:border-r lg:border-b-0 lg:px-[18px] lg:py-[26px]">
        <Logo variant="imagotipo" width={112} className="-ml-1 mb-2 block lg:mb-0" />
        <header className="mb-3 flex items-center gap-2.5 print:hidden lg:mb-0 lg:px-1.5">
          {marca.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={marca.logo} alt="" className="h-9 w-9 shrink-0 rounded-[10px] object-cover" />
          ) : (
            <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-brand-sm bg-accent font-display text-[15px] text-deep">
              {iniciales(marca.nombre)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[14.5px] font-bold leading-tight">{marca.nombre}</p>
            <p className="text-[11.5px] text-ink-muted">{marca.subtitulo}</p>
          </div>
          <form action={cerrarSesion}>
            <button type="submit" className="rounded-[8px] border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-100 hover:text-ink">
              Salir
            </button>
          </form>
        </header>
        <NavPanel etiqueta={etiqueta} pestanas={pestanas} />
        {pie && <div className="mt-auto hidden lg:block">{pie}</div>}
      </aside>
      <div className="min-w-0 flex-1 px-4 pt-6 pb-16 lg:px-10 lg:pt-9">
        <div className="mx-auto max-w-[1180px]">
          <AvisoInstalar className="mb-6 print:hidden" />
          {children}
        </div>
        <footer className="mx-auto mt-14 max-w-[1180px] text-center text-caption text-ink-muted print:hidden">{FIRMA}</footer>
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
    <div className="rounded-brand-sm bg-surface-100 p-3">
      <p className="flex items-center gap-[7px] text-[12.5px] font-semibold">
        <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${activo ? "bg-brand" : "border-2 border-ink-muted"}`} />
        {activo ? "Menú activo" : "Menú pausado"}
      </p>
      <p className="mt-1 text-[11.5px] text-ink-muted">{activo ? "Tus clientes lo están viendo" : `Contacta a ${EMPRESA}`}</p>
    </div>
  );
}

// Pestañas de un local dentro del super admin (en fila, sobre el contenido).
export function MarcoPanel({ etiqueta, pestanas, children }: { etiqueta: string; pestanas: PestanaPanel[]; children: ReactNode }) {
  return (
    <>
      <div className="mb-6 rounded-brand border border-line bg-surface-200 px-4 py-2 print:hidden">
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
