import { formatBs, formatUsd, usdToBs } from "@/lib/precios";
import type { Producto } from "@/types/menu";

export function ProductoCard({ producto, tasaBs }: { producto: Producto; tasaBs: number }) {
  const agotado = !producto.disponible;

  return (
    <li className={`flex gap-3 py-3 ${agotado ? "opacity-60" : ""}`}>
      {producto.foto_url ? (
        // Las fotos llegan en la Fase 5 (Supabase Storage); entonces se pasa a next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={producto.foto_url}
          alt={producto.nombre}
          loading="lazy"
          className="h-20 w-20 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-2xl font-semibold text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
        >
          {producto.nombre.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium leading-tight">{producto.nombre}</h3>
          {agotado && (
            <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              Agotado
            </span>
          )}
        </div>
        {producto.descripcion && (
          <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{producto.descripcion}</p>
        )}
        <p className="mt-1 text-sm">
          <span className="font-semibold text-(--acento)">{formatUsd(producto.precio_usd)}</span>
          {tasaBs > 0 && (
            <span className="ml-2 text-zinc-500 dark:text-zinc-400">
              {formatBs(usdToBs(producto.precio_usd, tasaBs))}
            </span>
          )}
        </p>
      </div>
    </li>
  );
}
