import { actualizarAjustes, cambiarClave } from "@/app/admin/actions";
import { Boton, estiloCampo, FormAccion } from "@/components/admin/ui";
import { cargarPanel } from "@/lib/admin";

export const metadata = { title: "Panel — Ajustes" };

export default async function PanelAjustes() {
  const { negocio } = await cargarPanel();

  return (
    <main className="space-y-10">
      <section aria-labelledby="local">
        <h2 id="local" className="text-lg font-semibold">Datos del local</h2>
        <FormAccion accion={actualizarAjustes} className="mt-3 space-y-3">
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
            <span className="text-xs text-zinc-500">Con código de país. Ej: 584121234567 o 0412-1234567.</span>
          </label>
          <label className="block text-sm">
            Horario
            <input name="horario" maxLength={200} defaultValue={negocio.horario ?? ""} className={estiloCampo} />
          </label>
          <label className="block text-sm">
            Color del menú
            <input
              name="color"
              defaultValue={negocio.color ?? ""}
              placeholder="#B45309"
              maxLength={7}
              className={estiloCampo}
            />
            <span className="text-xs text-zinc-500">Formato #RRGGBB. Déjalo vacío para el color por defecto.</span>
          </label>
          <Boton>Guardar ajustes</Boton>
        </FormAccion>
      </section>

      <section aria-labelledby="clave">
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
    </main>
  );
}
