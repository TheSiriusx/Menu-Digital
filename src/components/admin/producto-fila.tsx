import {
  actualizarPrecio,
  actualizarProducto,
  actualizarStock,
  alternarDisponible,
  borrarProducto,
  moverProducto,
  quitarFotoProducto,
  subirFotoProducto,
} from "@/app/admin/actions";
import { CampoNegocio } from "@/components/admin/campo-negocio";
import { SubirImagen } from "@/components/admin/subir-imagen";
import { Boton, FormAccion } from "@/components/admin/ui";
import { estiloCampo } from "@/components/admin/estilos";
import { formatBs, usdToBs } from "@/lib/precios";
import type { CategoriaPanel, ProductoPanel } from "@/types/panel";

function Flecha({ id, negocioId, direccion, deshabilitada }: { id: string; negocioId: string; direccion: "arriba" | "abajo"; deshabilitada: boolean }) {
  return (
    <form action={moverProducto}>
      <CampoNegocio id={negocioId} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direccion" value={direccion} />
      <button
        type="submit"
        disabled={deshabilitada}
        aria-label={direccion === "arriba" ? "Subir" : "Bajar"}
        className="h-8 w-8 rounded-full border border-line text-sm disabled:opacity-30"
      >
        {direccion === "arriba" ? "↑" : "↓"}
      </button>
    </form>
  );
}

export function ProductoFila({
  producto,
  negocioId,
  categorias,
  tasaBs,
  primero,
  ultimo,
}: {
  producto: ProductoPanel;
  negocioId: string;
  categorias: CategoriaPanel[];
  tasaBs: number;
  primero: boolean;
  ultimo: boolean;
}) {
  return (
    <li className="py-2.5" data-producto={producto.nombre}>
      {/* Línea 1: foto, nombre y orden */}
      <div className="flex items-center gap-3">
        {producto.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={producto.foto_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
        ) : (
          <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface font-semibold text-muted">
            {producto.nombre.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{producto.nombre}</p>
          {tasaBs > 0 && <p className="text-xs text-muted">{formatBs(usdToBs(producto.precio_usd, tasaBs))}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <Flecha id={producto.id} negocioId={negocioId} direccion="arriba" deshabilitada={primero} />
          <Flecha id={producto.id} negocioId={negocioId} direccion="abajo" deshabilitada={ultimo} />
        </div>
      </div>

      {/* Línea 2: precio y disponibilidad, lo que se toca a diario */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <FormAccion accion={actualizarPrecio} className="flex items-center gap-1.5">
          <CampoNegocio id={negocioId} />
          <input type="hidden" name="id" value={producto.id} />
          <span aria-hidden="true" className="text-sm text-muted">$</span>
          <input
            name="precio"
            aria-label={`Precio en dólares de ${producto.nombre}`}
            inputMode="decimal"
            defaultValue={producto.precio_usd.toFixed(2).replace(".", ",")}
            className={`${estiloCampo} w-20! px-2.5! py-1.5!`}
          />
          <Boton variante="suave" tamano="compacto">Guardar</Boton>
        </FormAccion>

        <FormAccion accion={actualizarStock} className="flex items-center gap-1.5">
          <CampoNegocio id={negocioId} />
          <input type="hidden" name="id" value={producto.id} />
          <input
            name="stock"
            type="number"
            min={0}
            max={1000000}
            step={1}
            inputMode="numeric"
            aria-label={`Stock de ${producto.nombre} (vacío = sin control)`}
            placeholder="Sin control"
            defaultValue={producto.stock ?? ""}
            className={`${estiloCampo} w-32! px-2.5! py-1.5!`}
          />
          <Boton variante="suave" tamano="compacto">Stock</Boton>
        </FormAccion>

        <form action={alternarDisponible}>
          <CampoNegocio id={negocioId} />
          <input type="hidden" name="id" value={producto.id} />
          <input type="hidden" name="disponible" value={String(!producto.disponible)} />
          <button
            type="submit"
            aria-pressed={producto.disponible}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              producto.disponible
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                : "bg-surface text-muted"
            }`}
          >
            {producto.disponible ? "Disponible" : "Agotado"}
          </button>
        </form>
      </div>

      {/* Lo demás, plegado */}
      <details className="mt-1.5">
        <summary className="cursor-pointer text-sm text-muted">Más opciones</summary>

        <div className="mt-2 flex flex-wrap items-start gap-2">
          <SubirImagen
            accion={subirFotoProducto}
            campos={{ negocio: negocioId, id: producto.id }}
            lado={480}
            texto={producto.foto_url ? "Cambiar foto" : "Agregar foto"}
          />
          {producto.foto_url && (
            <form action={quitarFotoProducto}>
              <CampoNegocio id={negocioId} />
              <input type="hidden" name="id" value={producto.id} />
              <Boton variante="suave">Quitar foto</Boton>
            </form>
          )}
        </div>

        <FormAccion accion={actualizarProducto} className="mt-3 space-y-2">
          <CampoNegocio id={negocioId} />
          <input type="hidden" name="id" value={producto.id} />
          <label className="block text-sm">
            Nombre
            <input name="nombre" required maxLength={120} defaultValue={producto.nombre} className={estiloCampo} />
          </label>
          <label className="block text-sm">
            Descripción
            <input name="descripcion" maxLength={500} defaultValue={producto.descripcion ?? ""} className={estiloCampo} />
          </label>
          <label className="block text-sm">
            Categoría
            <select name="categoria" defaultValue={producto.categoria_id ?? ""} className={estiloCampo}>
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </label>
          <Boton>Guardar cambios</Boton>
        </FormAccion>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-red-700 dark:text-red-400">Borrar producto</summary>
          <form action={borrarProducto} className="mt-2">
            <CampoNegocio id={negocioId} />
            <input type="hidden" name="id" value={producto.id} />
            <p className="mb-2 text-sm">¿Seguro? No se puede deshacer.</p>
            <Boton variante="peligro">Sí, borrar</Boton>
          </form>
        </details>
      </details>
    </li>
  );
}
