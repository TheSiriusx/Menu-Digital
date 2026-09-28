"use client";

import { useEffect, useRef, useState } from "react";

// Pestañas de categorías: todas las categorías se ven seguidas; tocar una salta a su sección y, al deslizar,
// la pestaña de la sección visible se marca sola (y se centra en la barra).
export function TabsCategorias({ categorias }: { categorias: { id: string; nombre: string }[] }) {
  const [activa, setActiva] = useState(categorias[0]?.id ?? "");
  const botones = useRef(new Map<string, HTMLAnchorElement>());

  useEffect(() => {
    const secciones = categorias
      .map((c) => document.getElementById(`cat-${c.id}`))
      .filter((s): s is HTMLElement => s !== null);
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id.replace(/^cat-/, ""));
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    secciones.forEach((s) => observador.observe(s));
    return () => observador.disconnect();
  }, [categorias]);

  useEffect(() => {
    botones.current.get(activa)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activa]);

  return (
    <nav
      aria-label="Categorías"
      className="sticky top-0 z-10 flex gap-2 overflow-x-auto bg-background/95 px-5 py-3 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {categorias.map((c) => (
        <a
          key={c.id}
          ref={(el) => {
            if (el) botones.current.set(c.id, el);
          }}
          href={`#cat-${c.id}`}
          onClick={() => setActiva(c.id)}
          aria-current={activa === c.id ? "true" : undefined}
          className={`shrink-0 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${
            activa === c.id ? "border-(--acento) bg-(--acento) text-(--sobre-acento)" : "border-line bg-card text-foreground"
          }`}
        >
          {c.nombre}
        </a>
      ))}
    </nav>
  );
}
