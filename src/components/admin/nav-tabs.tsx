"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Pestana = { href: string; texto: string; exacto?: boolean; nuevaPestana?: boolean };

// Pestañas del panel. La activa se marca según la ruta actual.
export function NavTabs({ etiqueta, pestanas }: { etiqueta: string; pestanas: Pestana[] }) {
  const ruta = usePathname();
  return (
    <nav aria-label={etiqueta} className="flex flex-1 flex-wrap gap-1.5">
      {pestanas.map((p) => {
        const activa = !p.nuevaPestana && (p.exacto ? ruta === p.href : ruta.startsWith(p.href));
        return (
          <Link
            key={p.href}
            href={p.href}
            target={p.nuevaPestana ? "_blank" : undefined}
            aria-current={activa ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              activa ? "bg-foreground text-background" : "text-muted hover:bg-surface"
            }`}
          >
            {p.texto}
          </Link>
        );
      })}
    </nav>
  );
}
