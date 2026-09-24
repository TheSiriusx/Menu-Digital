import { actualizarTasa, crearProducto } from "@/app/admin/actions";
import { Boton, estiloCampo, FormAccion } from "@/components/admin/ui";
import { ProductoFila } from "@/components/admin/producto-fila";
import { cargarPanel } from "@/lib/admin";
import type { Producto } from "@/types/menu";

export default async function PanelProductos() {
  const { negocio, categorias, productos } = await cargarPanel();

  const grupos: { clave: string; titulo: string | null; productos: Producto[] }[] = [
    ...categorias.map((c) => ({
      clave: c.id,
      titulo: c.nombre,
      productos: productos.filter((p) => p.categoria_id === c.id),
    })),
    {
      clave: "sin-categoria",
      titulo: "Sin categoría",
      productos: productos.filter((p) => !categorias.some((c) => c.id === p.categoria_id)),
    },
  ].filter((g) => g.productos.length > 0);

  return (
    <main className="space-y-8">
      {!negocio.activo && (
        <p role="status" className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Tu menú está pausado y los clientes no lo ven. Contacta a Starck Labs para reactivarlo.
        </p>
      )}

      <section aria-labelledby="tasa">
        <h2 id="tasa" className="text-lg font-semibold">Tasa del día</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Bolívares por cada dólar. Actualízala cuando cambie.</p>
        <FormAccion accion={actualizarTasa} className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            Bs por $1
            <input
              name="tasa"
              inputMode="decimal"
              required
              defaultValue={negocio.tasa_bs > 0 ? String(negocio.tasa_bs).replace(".", ",") : ""}
              className={`${estiloCampo} w-32`}
            />
          </label>
          <Boton>Guardar tasa</Boton>
        </FormAccion>
      </section>

      <section aria-labelledby="nuevo">
        <details>
          <summary id="nuevo" className="cursor-pointer text-lg font-semibold">Agregar producto</summary>
          <FormAccion accion={crearProducto} className="mt-3 space-y-2">
            <label className="block text-sm">
              Nombre
              <input name="nombre" required maxLength={120} className={estiloCampo} />
            </label>
            <label className="block text-sm">
              Descripción (opcional)
              <input name="descripcion" maxLength={500} className={estiloCampo} />
            </label>
            <label className="block text-sm">
              Precio en dólares
              <input name="precio" required inputMode="decimal" placeholder="1,50" className={estiloCampo} />
            </label>
            <label className="block text-sm">
              Categoría
              <select name="categoria" defaultValue="" className={estiloCampo}>
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </label>
            <Boton>Agregar</Boton>
          </FormAccion>
        </details>
      </section>

      <section aria-labelledby="lista" className="space-y-6">
        <h2 id="lista" className="text-lg font-semibold">Productos</h2>
        {grupos.length === 0 && <p className="text-zinc-600 dark:text-zinc-400">Todavía no hay productos.</p>}
        {grupos.map((g) => (
          <div key={g.clave}>
            <h3 className="border-b-2 border-zinc-900 pb-1 font-semibold dark:border-zinc-100">{g.titulo}</h3>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {g.productos.map((p, i) => (
                <ProductoFila
                  key={p.id}
                  producto={p}
                  categorias={categorias}
                  tasaBs={negocio.tasa_bs}
                  primero={i === 0}
                  ultimo={i === g.productos.length - 1}
                />
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
