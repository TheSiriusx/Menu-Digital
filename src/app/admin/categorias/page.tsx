import { borrarCategoria, crearCategoria, moverCategoria, renombrarCategoria } from "@/app/admin/actions";
import { Boton, estiloCampo, FormAccion } from "@/components/admin/ui";
import { cargarPanel } from "@/lib/admin";

export const metadata = { title: "Panel — Categorías" };

function Flecha({ id, direccion, deshabilitada }: { id: string; direccion: "arriba" | "abajo"; deshabilitada: boolean }) {
  return (
    <form action={moverCategoria}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direccion" value={direccion} />
      <button
        type="submit"
        disabled={deshabilitada}
        aria-label={direccion === "arriba" ? "Subir" : "Bajar"}
        className="h-9 w-9 rounded-full border border-zinc-300 disabled:opacity-30 dark:border-zinc-700"
      >
        {direccion === "arriba" ? "↑" : "↓"}
      </button>
    </form>
  );
}

export default async function PanelCategorias() {
  const { categorias, productos } = await cargarPanel();

  return (
    <main className="space-y-8">
      <section aria-labelledby="nueva">
        <h2 id="nueva" className="text-lg font-semibold">Nueva categoría</h2>
        <FormAccion accion={crearCategoria} className="mt-2 flex flex-wrap items-center gap-2">
          <input name="nombre" required maxLength={60} aria-label="Nombre de la categoría" placeholder="Ej. Bebidas" className={`${estiloCampo} w-56`} />
          <Boton>Agregar</Boton>
        </FormAccion>
      </section>

      <section aria-labelledby="lista">
        <h2 id="lista" className="text-lg font-semibold">Categorías</h2>
        {categorias.length === 0 && <p className="mt-2 text-zinc-600 dark:text-zinc-400">Todavía no hay categorías.</p>}
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {categorias.map((c, i) => {
            const cantidad = productos.filter((p) => p.categoria_id === c.id).length;
            return (
              <li key={c.id} className="py-3" data-categoria={c.nombre}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">
                    {c.nombre} <span className="text-sm font-normal text-zinc-500">({cantidad})</span>
                  </p>
                  <div className="flex gap-1">
                    <Flecha id={c.id} direccion="arriba" deshabilitada={i === 0} />
                    <Flecha id={c.id} direccion="abajo" deshabilitada={i === categorias.length - 1} />
                  </div>
                </div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-sm text-zinc-600 dark:text-zinc-400">Renombrar o borrar</summary>
                  <FormAccion accion={renombrarCategoria} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={c.id} />
                    <input name="nombre" required maxLength={60} aria-label="Nuevo nombre" defaultValue={c.nombre} className={`${estiloCampo} w-56`} />
                    <Boton>Guardar</Boton>
                  </FormAccion>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-red-700 dark:text-red-400">Borrar categoría</summary>
                    <form action={borrarCategoria} className="mt-2">
                      <input type="hidden" name="id" value={c.id} />
                      <p className="mb-2 text-sm">
                        Los {cantidad} productos de esta categoría no se borran: quedan «Sin categoría».
                      </p>
                      <Boton variante="peligro">Sí, borrar categoría</Boton>
                    </form>
                  </details>
                </details>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
