import type { ReactNode } from "react";
import { NavPanel, type PestanaPanel } from "@/components/admin/nav-panel";

// Marco de las cinco pestañas: arriba en el celular, barra lateral fija en pantalla ancha.
export function MarcoPanel({ etiqueta, pestanas, children }: { etiqueta: string; pestanas: PestanaPanel[]; children: ReactNode }) {
  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div className="mb-6 print:hidden lg:sticky lg:top-6 lg:mb-0">
        <NavPanel etiqueta={etiqueta} pestanas={pestanas} />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function pestanasDe(base: string, slug: string | null): PestanaPanel[] {
  return [
    { href: base, texto: "Dashboard", exacto: true },
    { href: `${base}/menu`, texto: "Editar menú" },
    { href: `${base}/pedidos`, texto: "Pedidos" },
    { href: `${base}/clientes`, texto: "Clientes" },
    { href: `${base}/configuracion`, texto: "Configuración" },
    ...(slug ? [{ href: `/${slug}`, texto: "Ver mi menú ↗", nuevaPestana: true }] : []),
  ];
}
