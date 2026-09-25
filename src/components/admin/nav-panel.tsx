"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type PestanaPanel = { href: string; texto: string; exacto?: boolean; nuevaPestana?: boolean };

// Navegación del panel: pestañas en fila (con desplazamiento) en el celular y barra lateral en pantalla ancha.
export function NavPanel({ etiqueta, pestanas }: { etiqueta: string; pestanas: PestanaPanel[] }) {
  const ruta = usePathname();
  return (
    <nav aria-label={etiqueta} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
      {pestanas.map((p) => {
        const activa = !p.nuevaPestana && (p.exacto ? ruta === p.href : ruta === p.href || ruta.startsWith(`${p.href}/`));
        return (
          <Link
            key={p.href}
            href={p.href}
            target={p.nuevaPestana ? "_blank" : undefined}
            rel={p.nuevaPestana ? "noopener noreferrer" : undefined}
            aria-current={activa ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium lg:rounded-xl lg:px-3 lg:py-2 ${
              activa ? "bg-foreground text-background" : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            {p.texto}
          </Link>
        );
      })}
    </nav>
  );
}
