import { formatBs, formatUsd, usdToBs } from "@/lib/precios";
import type { Producto } from "@/types/menu";

// Selector de cantidad. `acento` lo pinta con el color del local (sobre la foto); sin él es neutro (en el pedido).
export function Cantidad({
  nombre,
  cantidad,
  onCambiar,
  acento = false,
}: {
  nombre: string;
  cantidad: number;
  onCambiar: (delta: number) => void;
  acento?: boolean;
}) {
  const contenedor = acento
    ? "bg-(--acento) text-(--sobre-acento) shadow-md"
    : "border border-line bg-background";
  const boton = "flex h-9 w-9 items-center justify-center text-lg leading-none";
  return (
    <div className={`inline-flex items-center rounded-full ${contenedor}`}>
      <button type="button" className={boton} aria-label={`Quitar uno de ${nombre}`} onClick={() => onCambiar(-1)}>
        −
      </button>
      <span className="min-w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {cantidad}
      </span>
      <button type="button" className={boton} aria-label={`Agregar uno de ${nombre}`} onClick={() => onCambiar(1)}>
        +
      </button>
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
    <li className="flex gap-4 rounded-2xl border border-line bg-background p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <div className="min-w-0 flex-1 py-1">
        <h3 className={`font-medium leading-snug ${agotado ? "text-muted" : ""}`}>{producto.nombre}</h3>
        {producto.descripcion && (
          <p className="mt-1 line-clamp-2 text-sm text-muted">{producto.descripcion}</p>
        )}
        <p className={`mt-2 flex flex-wrap items-baseline gap-x-2 ${agotado ? "text-muted" : ""}`}>
          <span className="font-semibold tabular-nums">{formatUsd(producto.precio_usd)}</span>
          {tasaBs > 0 && (
            <span className="text-sm text-muted tabular-nums">{formatBs(usdToBs(producto.precio_usd, tasaBs))}</span>
          )}
        </p>
        {agotado && (
          <span className="mt-2 inline-block rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">
            Agotado
          </span>
        )}
      </div>

      <div className="relative shrink-0 self-start">
        {producto.foto_url ? (
          // <img> a propósito: las fotos ya llegan reducidas a 480 px (ver subir-imagen.tsx).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={producto.foto_url}
            alt={producto.nombre}
            width={96}
            height={96}
            loading="lazy"
            className={`h-24 w-24 rounded-xl object-cover ${agotado ? "opacity-50 grayscale" : ""}`}
          />
        ) : (
          <div
            aria-hidden="true"
            className={`flex h-24 w-24 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--acento)_10%,var(--surface))] text-3xl font-semibold text-[color-mix(in_oklab,var(--acento)_55%,var(--muted))] ${agotado ? "opacity-50" : ""}`}
          >
            {producto.nombre.charAt(0).toUpperCase()}
          </div>
        )}

        {!agotado && (
          <div className="absolute -right-1 -bottom-3">
            {cantidad > 0 ? (
              <Cantidad nombre={producto.nombre} cantidad={cantidad} onCambiar={onCambiar} acento />
            ) : (
              <button
                type="button"
                onClick={() => onCambiar(1)}
                aria-label={`Agregar ${producto.nombre}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-(--acento) text-xl leading-none text-(--sobre-acento) shadow-md"
              >
                +
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
