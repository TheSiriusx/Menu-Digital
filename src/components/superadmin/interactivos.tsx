"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icono } from "@/components/iconos";

// Abre el panel «Nuevo local» (un <details> del servidor) y lleva el foco al nombre. Lo usan el botón del
// encabezado y la tarjeta «Agregar un nuevo local».
export function AbrirNuevoLocal({ className, children }: { className: string; children: ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const panel = document.getElementById("panel-nuevo-local") as HTMLDetailsElement | null;
        if (!panel) return;
        panel.open = true;
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => panel.querySelector<HTMLInputElement>("input[name=nombre]")?.focus(), 300);
      }}
    >
      {children}
    </button>
  );
}

// Minúsculas y sin tildes (igual que `paraBuscar` en el servidor), para buscar «panaderia» y hallar «Panadería».
const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const ESTADOS = [
  { valor: "todos", texto: "Todos los estados" },
  { valor: "activos", texto: "Activos" },
  { valor: "pausados", texto: "Pausados" },
  { valor: "whatsapp-pendiente", texto: "WhatsApp pendiente" },
  { valor: "sin-dueno", texto: "Sin dueño" },
];

// Buscador, filtro por estado y vista tarjetas/lista. Las tarjetas las pinta el servidor: aquí solo se ocultan
// las que no coinciden (por sus atributos data-buscar y data-filtros) y se cambia la grilla.
export function FiltroLocales({ children }: { children: ReactNode }) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState("todos");
  const [vista, setVista] = useState<"tarjetas" | "lista">("tarjetas");
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const raiz = caja.current;
    if (!raiz) return;
    const q = normalizar(texto);
    let visibles = 0;
    raiz.querySelectorAll<HTMLElement>("[data-local]").forEach((el) => {
      const coincide = (!q || (el.dataset.buscar ?? "").includes(q)) && (estado === "todos" || (el.dataset.filtros ?? "").split(" ").includes(estado));
      el.hidden = !coincide;
      if (coincide) visibles++;
    });
    const vacio = raiz.querySelector<HTMLElement>("[data-sin-resultados]");
    if (vacio) vacio.hidden = visibles > 0;
    const agregar = raiz.querySelector<HTMLElement>("[data-agregar]");
    if (agregar) agregar.hidden = q !== "" || estado !== "todos";
  }, [texto, estado]);

  const botonVista = (v: "tarjetas" | "lista", titulo: string, icono: "cuadricula" | "lista") => (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={vista === v}
      onClick={() => setVista(v)}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${vista === v ? "bg-card text-(--acento-texto) shadow-(--sombra-1)" : "text-muted hover:text-foreground"}`}
    >
      <Icono nombre={icono} tamano={18} />
    </button>
  );

  return (
    <div ref={caja}>
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-card p-3 shadow-(--sombra-1) md:flex-row md:items-center">
        <label className="relative flex-1 md:max-w-md">
          <span className="sr-only">Buscar local</span>
          <Icono nombre="buscar" tamano={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre, enlace o teléfono…"
            className="w-full rounded-[10px] border border-transparent bg-surface py-2 pr-4 pl-10 text-sm outline-none placeholder:text-muted focus:border-(--acento) focus:bg-card focus:ring-3 focus:ring-(--acento)/15"
          />
        </label>
        <div className="flex items-center gap-3">
          <label className="relative flex-1 md:flex-none">
            <span className="sr-only">Filtrar por estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full appearance-none rounded-[10px] border border-transparent bg-surface py-2 pr-9 pl-3 text-[13px] font-semibold outline-none focus:border-(--acento) focus:ring-3 focus:ring-(--acento)/15"
            >
              {ESTADOS.map((e) => <option key={e.valor} value={e.valor}>{e.texto}</option>)}
            </select>
            <Icono nombre="chevron" tamano={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rotate-90 text-muted" />
          </label>
          <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
            {botonVista("tarjetas", "Vista en tarjetas", "cuadricula")}
            {botonVista("lista", "Vista en lista", "lista")}
          </div>
        </div>
      </div>
      <div data-vista={vista} className="group/locales">{children}</div>
    </div>
  );
}
