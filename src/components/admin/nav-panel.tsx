"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type Icono = "dashboard" | "menu" | "pedidos" | "clientes" | "configuracion" | "externo" | "locales" | "cuenta" | "seguridad";
export type PestanaPanel = { href: string; texto: string; icono?: Icono; exacto?: boolean; nuevaPestana?: boolean };

const trazo = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICONOS: Record<Icono, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  pedidos: <><path d="M6 2h9l3 3v17H6z" /><path d="M9 10h6M9 14h6" /></>,
  clientes: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c1-4 3.4-6 6.5-6s5.5 2 6.5 6" /><circle cx="18" cy="9" r="2.4" /><path d="M15.8 14.2c2.5.3 4.2 2.1 5 5.8" /></>,
  configuracion: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  externo: <><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
  locales: <><path d="M3 10l1.5-5h15L21 10" /><path d="M4 10v10h16V10" /><path d="M9 20v-6h6v6" /></>,
  cuenta: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  seguridad: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
};

// Pestañas del panel. «lateral»: columna en la barra lateral (en el celular, fila con desplazamiento).
// «horizontal»: siempre en fila (las pestañas de un local dentro del super admin).
export function NavPanel({ etiqueta, pestanas, orientacion = "lateral" }: { etiqueta: string; pestanas: PestanaPanel[]; orientacion?: "lateral" | "horizontal" }) {
  const ruta = usePathname();
  const lateral = orientacion === "lateral";
  return (
    <nav
      aria-label={etiqueta}
      className={`-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${lateral ? "lg:mx-0 lg:flex-col lg:gap-[3px] lg:overflow-visible lg:px-0" : ""}`}
    >
      {pestanas.map((p) => {
        const activa = !p.nuevaPestana && (p.exacto ? ruta === p.href : ruta === p.href || ruta.startsWith(`${p.href}/`));
        return (
          <Link
            key={p.href}
            href={p.href}
            target={p.nuevaPestana ? "_blank" : undefined}
            rel={p.nuevaPestana ? "noopener noreferrer" : undefined}
            aria-current={activa ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-[10px] px-3 py-2 text-[13.5px] font-semibold transition-colors ${
              activa ? "bg-(--acento-suave) text-(--acento-texto)" : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            {p.icono && (
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" className={`shrink-0 ${lateral ? "hidden lg:block" : "hidden"}`} {...trazo}>
                {ICONOS[p.icono]}
              </svg>
            )}
            {p.texto}
          </Link>
        );
      })}
    </nav>
  );
}
