import { formatBs, formatUsd, usdToBs } from "@/lib/precios";
import type { Producto } from "@/types/menu";

// Selector de cantidad: «−» (borde), cantidad y «+» (acento). `compacto` para la pantalla del pedido.
export function Cantidad({
  nombre,
  cantidad,
  onCambiar,
  compacto = false,
}: {
  nombre: string;
  cantidad: number;
  onCambiar: (delta: number) => void;
  compacto?: boolean;
}) {
  const tam = compacto ? "h-7 w-7 text-base" : "h-8 w-8 text-lg";
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <button
        type="button"
        className={`flex ${tam} items-center justify-center rounded-full border border-line bg-card leading-none text-foreground`}
        aria-label={`Quitar uno de ${nombre}`}
        onClick={() => onCambiar(-1)}
      >
        −
      </button>
      <span className="min-w-4 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {cantidad}
      </span>
      <button
        type="button"
        className={`flex ${tam} items-center justify-center rounded-full bg-(--acento) leading-none text-(--sobre-acento)`}
        aria-label={`Agregar uno de ${nombre}`}
        onClick={() => onCambiar(1)}
      >
        +
      </button>
    </div>
  );
}

// Miniatura: la foto del producto, o su inicial sobre un tono suave.
export function Miniatura({ producto, tam, apagada = false }: { producto: Producto; tam: string; apagada?: boolean }) {
  return producto.foto_url ? (
    // <img> a propósito: las fotos ya llegan reducidas a 480 px (ver subir-imagen.tsx).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={producto.foto_url}
      alt={producto.nombre}
      loading="lazy"
      className={`${tam} shrink-0 rounded-xl object-cover ${apagada ? "grayscale" : ""}`}
    />
  ) : (
    <div
      aria-hidden="true"
      className={`${tam} flex shrink-0 items-center justify-center rounded-xl bg-surface font-titulo text-2xl font-semibold text-muted`}
    >
      {producto.nombre.charAt(0).toUpperCase()}
    </div>
  );
}

export function ProductoCard({
  producto,
  tasaBs,
  cantidad,
  onCambiar,
}: {
  producto: Producto;
  tasaBs: number;
  cantidad: number;
  onCambiar: (delta: number) => void;
}) {
  const agotado = !producto.disponible;

  return (
    <li className={`flex items-center gap-3 rounded-2xl border border-line bg-card p-3 ${agotado ? "opacity-55" : ""}`}>
      <Miniatura producto={producto} tam="h-[68px] w-[68px]" apagada={agotado} />
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-semibold leading-snug">{producto.nombre}</h3>
        {producto.descripcion && <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted">{producto.descripcion}</p>}
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[14.5px] font-semibold text-(--acento-texto) tabular-nums">{formatUsd(producto.precio_usd)}</span>
          {tasaBs > 0 && <span className="text-xs text-muted tabular-nums">{formatBs(usdToBs(producto.precio_usd, tasaBs))}</span>}
        </p>
      </div>

      {agotado ? (
        <span className="shrink-0 rounded-full bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted">Agotado</span>
      ) : cantidad > 0 ? (
        <Cantidad nombre={producto.nombre} cantidad={cantidad} onCambiar={onCambiar} />
      ) : (
        <button
          type="button"
          onClick={() => onCambiar(1)}
          aria-label={`Agregar ${producto.nombre}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--acento) text-lg leading-none text-(--sobre-acento)"
        >
          +
        </button>
      )}
    </li>
  );
}
