import type { ReactNode } from "react";
import { cerrarSesion } from "@/app/admin/actions";
import { fuentesSuperadmin } from "@/app/superadmin/fuentes";
import { Icono } from "@/components/iconos";
import { Migas, NavInferior, NavLateral } from "@/components/superadmin/nav";
import { EMPRESA, MARCA } from "@/lib/marca";

function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <div aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--acento) font-titulo text-base font-bold text-(--sobre-acento)">P</div>
      <div className="flex flex-col items-start leading-tight">
        <span className="font-titulo text-[15px] font-bold tracking-tight">{MARCA}</span>
        <span className="mt-0.5 rounded-full bg-(--acento-suave) px-1.5 py-px text-[10.5px] font-semibold text-(--acento-texto)">Super Admin</span>
      </div>
    </div>
  );
}

// Armazón del super admin («Warm Culinary Modernism»). Computadora: barra lateral blanca de 260 px y migas
// arriba. Celular: barra superior con la marca y pestañas fijas abajo.
export function MarcoSuperadmin({ locales, children }: { locales: number; children: ReactNode }) {
  return (
    <div className={`tema-superadmin ${fuentesSuperadmin} flex min-h-dvh flex-1 bg-background text-foreground`}>
      <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col justify-between border-r border-line bg-card px-4 py-6 lg:flex print:hidden">
        <div className="flex flex-col gap-7">
          <div className="px-2"><Marca /></div>
          <NavLateral locales={locales} />
        </div>
        <div className="flex flex-col gap-4">
          <form action={cerrarSesion}>
            <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-peligro hover:bg-peligro-suave">
              <Icono nombre="salir" />
              Salir
            </button>
          </form>
          <p className="text-center text-xs text-muted">
            {MARCA} by <span className="font-semibold text-foreground">{EMPRESA}</span>
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-background/85 px-4 backdrop-blur-xl lg:px-8 print:hidden">
          <div className="lg:hidden"><Marca /></div>
          <div className="hidden min-w-0 lg:block"><Migas /></div>
          <form action={cerrarSesion} className="lg:hidden">
            <button type="submit" className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium text-peligro hover:bg-peligro-suave">
              <Icono nombre="salir" tamano={18} />
              Salir
            </button>
          </form>
        </header>
        <main className="flex-1 px-4 pt-6 pb-28 lg:px-8 lg:pt-8 lg:pb-16">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>

      <NavInferior locales={locales} />
    </div>
  );
}

// Encabezado de cada página: título, contador opcional, descripción y acciones a la derecha.
export function EncabezadoPagina({ titulo, etiqueta, descripcion, acciones }: { titulo: string; etiqueta?: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div className="max-w-2xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] leading-8 font-semibold tracking-tight lg:text-[28px]">{titulo}</h1>
          {etiqueta && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-0.5 text-xs font-semibold text-muted">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-(--acento)" />
              {etiqueta}
            </span>
          )}
        </div>
        {descripcion && <p className="mt-1.5 text-sm text-muted">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-3">{acciones}</div>}
    </div>
  );
}

// Tarjeta del sistema: blanca, borde fino cálido, sombra suave.
export const tarjetaSa = "rounded-2xl border border-line bg-card shadow-(--sombra-1)";
