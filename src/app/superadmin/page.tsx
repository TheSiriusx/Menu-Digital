import Link from "next/link";
import { cambiarEstado, cambiarPlan, crearLocal, quitarDueno, vincularDueno } from "@/app/superadmin/actions";
import { CampoNegocio } from "@/components/admin/campo-negocio";
import { Boton, FormAccion } from "@/components/admin/ui";
import { estiloCampo } from "@/components/admin/estilos";
import { requerirSuperadmin } from "@/lib/admin";
import { etiquetaPlan, etiquetaTipo, PLANES, TIPOS } from "@/lib/tipos";

type Local = {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  plan: string;
  activo: boolean;
  productos: number;
  duenos: string[];
  created_at: string;
};

export default async function Locales() {
  const { supabase } = await requerirSuperadmin();
  const { data, error } = await supabase.rpc("listar_negocios");
  if (error) throw new Error(`No se pudieron listar los locales: ${error.message}`);
  const locales = (data ?? []) as Local[];

  return (
    <main className="space-y-8">
      <section aria-labelledby="nuevo">
        <details>
          <summary id="nuevo" className="cursor-pointer text-lg font-semibold">Nuevo local</summary>
          <FormAccion accion={crearLocal} className="mt-3 space-y-2">
            <label className="block text-sm">
              Nombre
              <input name="nombre" required maxLength={80} className={estiloCampo} />
            </label>
            <label className="block text-sm">
              Enlace (opcional)
              <input name="slug" maxLength={60} placeholder="la-espiga" className={estiloCampo} />
              <span className="text-xs text-muted">Vacío = se genera del nombre. No se puede cambiar después.</span>
            </label>
            <label className="block text-sm">
              Tipo
              <select name="tipo" defaultValue="panaderia" className={estiloCampo}>
                {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              Plan
              <select name="plan" defaultValue="basico" className={estiloCampo}>
                {PLANES.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
              </select>
            </label>
            <Boton>Crear local</Boton>
          </FormAccion>
        </details>
      </section>

      <section aria-labelledby="lista">
        <h2 id="lista" className="text-lg font-semibold">
          Locales <span className="text-sm font-normal text-muted">({locales.length})</span>
        </h2>
        {locales.length === 0 && <p className="mt-2 text-muted">Todavía no hay locales.</p>}
        <ul className="divide-y divide-line">
          {locales.map((l) => (
            <li key={l.id} data-local={l.slug} className="py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{l.nombre}</p>
                  <p className="text-sm text-muted">
                    <Link href={`/${l.slug}`} target="_blank" className="underline">/{l.slug} ↗</Link>
                    {" · "}{etiquetaTipo(l.tipo)} · {l.productos} productos
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs font-medium">
                  <span
                    data-estado
                    className={`rounded-full px-2 py-0.5 ${
                      l.activo
                        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                        : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                    }`}
                  >
                    {l.activo ? "Activo" : "Pausado"}
                  </span>
                  <span className="rounded-full bg-surface px-2 py-0.5">{etiquetaPlan(l.plan)}</span>
                </div>
              </div>

              <p className="mt-1 text-sm">
                <span className="text-muted">Dueño: </span>
                {l.duenos.length > 0 ? l.duenos.join(", ") : <em>sin vincular</em>}
              </p>

              <div className="mt-2">
                <Link
                  href={`/superadmin/locales/${l.slug}`}
                  className="inline-block rounded-full border border-line px-4 py-2 text-sm font-medium"
                >
                  Administrar menú →
                </Link>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted">Estado, plan y dueño</summary>
                <div className="mt-3 space-y-5">
                  {l.activo ? (
                    <details>
                      <summary className="cursor-pointer text-sm text-amber-800 dark:text-amber-300">Pausar local (impago)</summary>
                      <form action={cambiarEstado} className="mt-2">
                        <CampoNegocio id={l.id} />
                        <input type="hidden" name="activo" value="false" />
                        <p className="mb-2 text-sm">
                          Los clientes verán «menú no disponible» y el dueño quedará en solo lectura.
                        </p>
                        <Boton variante="peligro">Sí, pausar</Boton>
                      </form>
                    </details>
                  ) : (
                    <form action={cambiarEstado}>
                      <CampoNegocio id={l.id} />
                      <input type="hidden" name="activo" value="true" />
                      <Boton>Reactivar local</Boton>
                    </form>
                  )}

                  <FormAccion accion={cambiarPlan} className="flex flex-wrap items-center gap-2">
                    <CampoNegocio id={l.id} />
                    <select name="plan" defaultValue={l.plan} aria-label="Plan" className={`${estiloCampo} w-40!`}>
                      {PLANES.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
                    </select>
                    <Boton variante="suave">Guardar plan</Boton>
                  </FormAccion>

                  <div>
                    <FormAccion accion={vincularDueno} className="flex flex-wrap items-center gap-2">
                      <CampoNegocio id={l.id} />
                      <input
                        name="correo"
                        type="email"
                        required
                        aria-label="Correo del dueño"
                        placeholder="correo del dueño"
                        className={`${estiloCampo} w-64!`}
                      />
                      <Boton variante="suave">Vincular dueño</Boton>
                    </FormAccion>
                    <p className="mt-1 text-xs text-muted">
                      La cuenta debe existir ya en Supabase (Authentication → Users).
                    </p>
                    {l.duenos.map((correo) => (
                      <form key={correo} action={quitarDueno} className="mt-2 flex items-center gap-2 text-sm">
                        <CampoNegocio id={l.id} />
                        <input type="hidden" name="correo" value={correo} />
                        <span>{correo}</span>
                        <Boton variante="suave">Quitar</Boton>
                      </form>
                    ))}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
