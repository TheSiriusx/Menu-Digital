import type { ReactNode } from "react";
import {
  actualizarAjustes,
  actualizarTasa,
  borrarCategoria,
  cambiarClave,
  crearCategoria,
  crearProducto,
  moverCategoria,
  quitarLogo,
  renombrarCategoria,
  subirLogo,
} from "@/app/admin/actions";
import { CampoNegocio } from "@/components/admin/campo-negocio";
import { CampoColor } from "@/components/admin/campo-color";
import { ProductoFila } from "@/components/admin/producto-fila";
import { SubirImagen } from "@/components/admin/subir-imagen";
import { WhatsAppVinculo } from "@/components/admin/whatsapp-vinculo";
import { Boton, FormAccion } from "@/components/admin/ui";
import { estiloCampo } from "@/components/admin/estilos";
import type { Panel } from "@/lib/admin";
import { ACENTO_POR_DEFECTO } from "@/lib/color";
import type { Producto } from "@/types/menu";

// Las tres pantallas del panel las usan el dueño (/admin) y el super admin
// (/superadmin/locales/[slug]). `superadmin` solo cambia los avisos.
export type Contexto = { superadmin: boolean };

const tarjeta = "rounded-2xl border border-line p-4";

function AvisoPausa({ panel, contexto }: { panel: Panel; contexto: Contexto }) {
  if (panel.negocio.activo) return null;
  return (
    <p role="status" className="mb-6 rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      {contexto.superadmin
        ? "Este local está pausado: los clientes no ven su menú. Tú puedes seguir editándolo."
        : "Tu menú está pausado y los clientes no lo ven. Puedes ver tus datos, pero no editarlos hasta ponerte al día. Contacta a Starck Labs."}
    </p>
  );
}

// Si el local está pausado el dueño no puede escribir (lo impone la base de datos); este
// fieldset además deshabilita botones y campos para que no parezca que funcionan.
// El super admin siempre puede editar.
function Editable({ panel, contexto, children }: { panel: Panel; contexto: Contexto; children: ReactNode }) {
  const soloLectura = !panel.negocio.activo && !contexto.superadmin;
  return (
    <fieldset disabled={soloLectura} className="m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  );
}

// ---------------------------------------------------------------- productos

export function VistaProductos({ panel, contexto }: { panel: Panel; contexto: Contexto }) {
  const { negocio, categorias, productos } = panel;

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
    <main>
      <AvisoPausa panel={panel} contexto={contexto} />
      <Editable panel={panel} contexto={contexto}>
        <div className="space-y-8">
          <section aria-labelledby="tasa" className={tarjeta}>
            <h2 id="tasa" className="text-lg font-semibold">Tasa del día</h2>
            <p className="text-sm text-muted">Bolívares por cada dólar. Actualízala cuando cambie.</p>
            <FormAccion accion={actualizarTasa} className="mt-2 flex flex-wrap items-center gap-2">
              <CampoNegocio id={negocio.id} />
              <label className="flex items-center gap-2 text-sm">
                Bs por $1
                <input
                  name="tasa"
                  inputMode="decimal"
                  required
                  defaultValue={negocio.tasa_bs > 0 ? String(negocio.tasa_bs).replace(".", ",") : ""}
                  className={`${estiloCampo} w-32!`}
                />
              </label>
              <Boton>Guardar tasa</Boton>
            </FormAccion>
          </section>

          <section aria-labelledby="nuevo" className={tarjeta}>
            <details>
              <summary id="nuevo" className="cursor-pointer text-lg font-semibold">Agregar producto</summary>
              <FormAccion accion={crearProducto} className="mt-3 space-y-2">
                <CampoNegocio id={negocio.id} />
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
            {grupos.length === 0 && <p className="text-muted">Todavía no hay productos.</p>}
            {grupos.map((g) => (
              <div key={g.clave} className={tarjeta}>
                <h3 className="pb-1 text-base font-semibold">{g.titulo}</h3>
                <ul className="divide-y divide-line">
                  {g.productos.map((p, i) => (
                    <ProductoFila
                      key={p.id}
                      producto={p}
                      negocioId={negocio.id}
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
        </div>
      </Editable>
    </main>
  );
}

// ---------------------------------------------------------------- categorías

function FlechaCategoria({
  id,
  negocioId,
  direccion,
  deshabilitada,
}: {
  id: string;
  negocioId: string;
  direccion: "arriba" | "abajo";
  deshabilitada: boolean;
}) {
  return (
    <form action={moverCategoria}>
      <CampoNegocio id={negocioId} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direccion" value={direccion} />
      <button
        type="submit"
        disabled={deshabilitada}
        aria-label={direccion === "arriba" ? "Subir" : "Bajar"}
        className="h-9 w-9 rounded-full border border-line disabled:opacity-30"
      >
        {direccion === "arriba" ? "↑" : "↓"}
      </button>
    </form>
  );
}

export function VistaCategorias({ panel, contexto }: { panel: Panel; contexto: Contexto }) {
  const { negocio, categorias, productos } = panel;

  return (
    <main>
      <AvisoPausa panel={panel} contexto={contexto} />
      <Editable panel={panel} contexto={contexto}>
        <div className="space-y-8">
          <section aria-labelledby="nueva" className={tarjeta}>
            <h2 id="nueva" className="text-lg font-semibold">Nueva categoría</h2>
            <FormAccion accion={crearCategoria} className="mt-2 flex flex-wrap items-center gap-2">
              <CampoNegocio id={negocio.id} />
              <input name="nombre" required maxLength={60} aria-label="Nombre de la categoría" placeholder="Ej. Bebidas" className={`${estiloCampo} w-56!`} />
              <Boton>Agregar</Boton>
            </FormAccion>
          </section>

          <section aria-labelledby="lista" className={tarjeta}>
            <h2 id="lista" className="text-lg font-semibold">Categorías</h2>
            {categorias.length === 0 && <p className="mt-2 text-muted">Todavía no hay categorías.</p>}
            <ul className="divide-y divide-line">
              {categorias.map((c, i) => {
                const cantidad = productos.filter((p) => p.categoria_id === c.id).length;
                return (
                  <li key={c.id} className="py-3" data-categoria={c.nombre}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">
                        {c.nombre} <span className="text-sm font-normal text-muted">({cantidad})</span>
                      </p>
                      <div className="flex gap-1">
                        <FlechaCategoria id={c.id} negocioId={negocio.id} direccion="arriba" deshabilitada={i === 0} />
                        <FlechaCategoria id={c.id} negocioId={negocio.id} direccion="abajo" deshabilitada={i === categorias.length - 1} />
                      </div>
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-sm text-muted">Renombrar o borrar</summary>
                      <FormAccion accion={renombrarCategoria} className="mt-2 flex flex-wrap items-center gap-2">
                        <CampoNegocio id={negocio.id} />
                        <input type="hidden" name="id" value={c.id} />
                        <input name="nombre" required maxLength={60} aria-label="Nuevo nombre" defaultValue={c.nombre} className={`${estiloCampo} w-56!`} />
                        <Boton>Guardar</Boton>
                      </FormAccion>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm text-red-700 dark:text-red-400">Borrar categoría</summary>
                        <form action={borrarCategoria} className="mt-2">
                          <CampoNegocio id={negocio.id} />
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
        </div>
      </Editable>
    </main>
  );
}

// ---------------------------------------------------------------- ajustes

export function FormularioClave() {
  return (
    <section aria-labelledby="clave" className={tarjeta}>
      <h2 id="clave" className="text-lg font-semibold">Cambiar contraseña</h2>
      <FormAccion accion={cambiarClave} className="mt-3 space-y-3">
        <label className="block text-sm">
          Nueva contraseña (mínimo 10 caracteres)
          <input name="clave" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className={estiloCampo} />
        </label>
        <label className="block text-sm">
          Repite la contraseña
          <input name="repetir" type="password" required minLength={10} maxLength={72} autoComplete="new-password" className={estiloCampo} />
        </label>
        <Boton>Cambiar contraseña</Boton>
      </FormAccion>
    </section>
  );
}

export function VistaAjustes({ panel, contexto }: { panel: Panel; contexto: Contexto }) {
  const { negocio } = panel;

  return (
    <main>
      <AvisoPausa panel={panel} contexto={contexto} />
      <div className="flex flex-col gap-6">
        <Editable panel={panel} contexto={contexto}>
          <section aria-labelledby="logo" className={`${tarjeta} mb-6`}>
            <h2 id="logo" className="text-lg font-semibold">Logo</h2>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {negocio.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={negocio.logo_url} alt="Logo del local" className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <div aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full bg-surface text-2xl font-semibold text-muted">
                  {negocio.nombre.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-wrap items-start gap-2">
                <SubirImagen
                  accion={subirLogo}
                  campos={{ negocio: negocio.id }}
                  lado={256}
                  texto={negocio.logo_url ? "Cambiar logo" : "Subir logo"}
                />
                {negocio.logo_url && (
                  <form action={quitarLogo}>
                    <CampoNegocio id={negocio.id} />
                    <Boton variante="suave">Quitar logo</Boton>
                  </form>
                )}
              </div>
            </div>
          </section>

          <section aria-labelledby="local" className={tarjeta}>
            <h2 id="local" className="text-lg font-semibold">Datos del local</h2>
            <FormAccion accion={actualizarAjustes} className="mt-3 space-y-3">
              <CampoNegocio id={negocio.id} />
              <label className="block text-sm">
                Nombre del local
                <input name="nombre" required maxLength={80} defaultValue={negocio.nombre} className={estiloCampo} />
              </label>
              <label className="block text-sm">
                WhatsApp para recibir pedidos
                <input
                  name="telefono"
                  inputMode="tel"
                  defaultValue={negocio.telefono_whatsapp ?? ""}
                  placeholder="584121234567"
                  className={estiloCampo}
                />
                <span className="text-xs text-muted">Con código de país. Ej: 584121234567 o 0412-1234567.</span>
              </label>
              <label className="block text-sm">
                Horario
                <input name="horario" maxLength={200} defaultValue={negocio.horario ?? ""} className={estiloCampo} />
              </label>
              <div className="block text-sm">
                Color del menú
                <CampoColor inicial={negocio.color} defecto={ACENTO_POR_DEFECTO} />
                <span className="text-xs text-muted">El texto sobre este color se elige solo para que siempre se lea.</span>
              </div>
              <Boton>Guardar ajustes</Boton>
            </FormAccion>
          </section>
        </Editable>

        {/* Vincular WhatsApp no depende del estado del local: se puede reescanear aunque esté pausado. */}
        <section aria-labelledby="whatsapp" className={tarjeta}>
          <h2 id="whatsapp" className="text-lg font-semibold">WhatsApp de pedidos</h2>
          <p className="mt-1 text-sm text-muted">
            El número de WhatsApp que atiende los pedidos de este local. Si se desvincula, puedes volver a escanearlo desde aquí.
          </p>
          <div className="mt-4">
            <WhatsAppVinculo negocioId={negocio.id} />
          </div>
        </section>

        {/* La contraseña es de la cuenta, no del local: el dueño puede cambiarla aunque esté pausado. */}
        {!contexto.superadmin && <FormularioClave />}
      </div>
    </main>
  );
}
