import { actualizarAsistente, alternarAsistente } from "@/app/admin/actions";
import { CampoNegocio } from "@/components/admin/campo-negocio";
import { estiloCampo } from "@/components/admin/estilos";
import { Editable, tarjeta, type Contexto } from "@/components/admin/panel-base";
import { Boton, FormAccion } from "@/components/admin/ui";
import type { Panel } from "@/lib/admin";
import { asistenteEncendido, DIAS, ESPERAS_RESENA, NOMBRE_DIA, type ConfigAsistente } from "@/lib/asistente";
import { fechaHora } from "@/lib/fechas";

const campoCorto = `${estiloCampo} w-28! px-2.5! py-1.5!`;
// Firefox y Chrome muestran la hora con «a. m./p. m.» según el idioma: necesita más ancho que un número.
const campoHora = `${estiloCampo} min-w-0 flex-1 px-2! py-1.5! text-sm! sm:w-36! sm:flex-none`;
const coma = (n: number | null) => (n === null ? "" : n.toFixed(2).replace(".", ","));

function Seccion({ id, titulo, descripcion, children }: { id: string; titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <div className={tarjeta} data-seccion-asistente={id}>
      <h3 className="text-base font-semibold">{titulo}</h3>
      {descripcion && <p className="mt-0.5 text-sm text-muted">{descripcion}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Estado({ config, negocioId }: { config: ConfigAsistente; negocioId: string }) {
  const encendido = asistenteEncendido(config);
  const enPausa = config.agente_activo && !encendido && config.pausado_hasta;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        data-estado-asistente={encendido ? "encendido" : "apagado"}
        className={`rounded-full px-3 py-1 text-sm font-medium ${
          encendido ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : "bg-surface text-muted"
        }`}
      >
        {encendido ? "Atendiendo" : enPausa ? `En pausa hasta ${fechaHora(config.pausado_hasta!)}` : "Apagado"}
      </span>
      <form action={alternarAsistente}>
        <CampoNegocio id={negocioId} />
        <input type="hidden" name="encender" value={String(!encendido)} />
        <Boton variante="suave" tamano="compacto">{encendido ? "Apagar asistente" : "Encender asistente"}</Boton>
      </form>
    </div>
  );
}

export function VistaAsistente({ panel, config, contexto }: { panel: Panel; config: ConfigAsistente | null; contexto: Contexto }) {
  const id = panel.negocio.id;
  if (!config) {
    return (
      <section aria-labelledby="asistente" className={tarjeta}>
        <h2 id="asistente" className="text-lg font-semibold">Asistente de WhatsApp</h2>
        <p className="mt-1 text-sm text-muted">Este local todavía no tiene configuración del asistente.</p>
      </section>
    );
  }
  const oculto = (seccion: string) => (
    <>
      <CampoNegocio id={id} />
      <input type="hidden" name="seccion" value={seccion} />
    </>
  );

  return (
    <section aria-labelledby="asistente" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="asistente" className="text-lg font-semibold">Asistente de WhatsApp</h2>
          <p className="text-sm text-muted">
            Responde a tus clientes, toma pedidos y les avisa cuando cambias el estado de su pedido.
          </p>
        </div>
      </div>

      <Editable panel={panel} contexto={contexto}>
        <div className="space-y-4">
          <div className={tarjeta}>
            <Estado config={config} negocioId={id} />
            <p className="mt-2 text-xs text-muted">
              Apagado, no le contesta a nadie. También puedes escribir «apagar», «apagar 3h» o «encender» en tu chat contigo mismo en WhatsApp.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
            <Seccion id="horario" titulo="Horario de atención" descripcion="El asistente atiende siempre; el horario sirve para decirle al cliente cuándo preparan su pedido.">
              <FormAccion conservar accion={actualizarAsistente} className="space-y-2">
                {oculto("horario")}
                <div className="space-y-2">
                  <p className="text-xs text-muted">El segundo horario es opcional (por ejemplo, si cierras a mediodía).</p>
                  {DIAS.map((d) => {
                    const tramos = config.horario[d] ?? [];
                    const t1 = tramos[0];
                    const t2 = tramos[1];
                    return (
                      <div key={d} className="rounded-xl border border-line px-3 py-2 text-sm" data-dia={d}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{NOMBRE_DIA[d]}</span>
                          <label className="flex items-center gap-1.5 text-muted">
                            <input type="checkbox" name={`cerrado_${d}`} defaultChecked={tramos.length === 0} /> Cerrado
                          </label>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                          <span className="flex w-full items-center gap-1.5 sm:w-auto">
                            <input type="time" name={`desde_${d}`} aria-label={`${NOMBRE_DIA[d]}: abre`} defaultValue={t1?.desde ?? "06:00"} className={campoHora} />
                            <span aria-hidden="true">a</span>
                            <input type="time" name={`hasta_${d}`} aria-label={`${NOMBRE_DIA[d]}: cierra`} defaultValue={t1?.hasta ?? "19:00"} className={campoHora} />
                          </span>
                          <span className="flex w-full items-center gap-1.5 sm:w-auto">
                            <span className="text-muted">y de</span>
                            <input type="time" name={`desde2_${d}`} aria-label={`${NOMBRE_DIA[d]}: abre de nuevo (opcional)`} defaultValue={t2?.desde ?? ""} className={campoHora} />
                            <span aria-hidden="true">a</span>
                            <input type="time" name={`hasta2_${d}`} aria-label={`${NOMBRE_DIA[d]}: cierra de nuevo (opcional)`} defaultValue={t2?.hasta ?? ""} className={campoHora} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2 pt-1 text-sm">
                  <input type="checkbox" name="acepta_fuera_horario" defaultChecked={config.acepta_fuera_horario} />
                  Aceptar pedidos con el local cerrado (se preparan al abrir)
                </label>
                <Boton>Guardar horario</Boton>
              </FormAccion>
            </Seccion>

            <div className="space-y-4">
              <Seccion id="pagos" titulo="Pagos" descripcion="El asistente nunca confirma un pago: el cliente manda el comprobante y tú lo confirmas en Pedidos.">
                <FormAccion conservar accion={actualizarAsistente} className="space-y-3">
                  {oculto("pagos")}
                  <label className="block text-sm">
                    Datos para pagar (pago móvil, Zelle, efectivo…)
                    <textarea name="datos_pago" rows={4} maxLength={600} defaultValue={config.datos_pago} placeholder={"Pago móvil: Banco, 0412-0000000, V-00000000\nZelle: correo@ejemplo.com"} className={estiloCampo} />
                  </label>
                  <fieldset className="space-y-1 text-sm">
                    <legend className="mb-1">¿Cuándo se los envío al cliente?</legend>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="pago_momento" value="al_registrar" defaultChecked={config.pago_momento === "al_registrar"} />
                      Apenas registro el pedido
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="pago_momento" value="al_confirmar" defaultChecked={config.pago_momento === "al_confirmar"} />
                      Cuando tú confirmas el pedido
                    </label>
                  </fieldset>
                  <Boton>Guardar pagos</Boton>
                </FormAccion>
              </Seccion>

              <Seccion id="entregas" titulo="Entregas">
                <FormAccion conservar accion={actualizarAsistente} className="space-y-3">
                  {oculto("entregas")}
                  <label className="block text-sm">
                    ¿Cómo entregas?
                    <select name="delivery_modo" defaultValue={config.delivery_modo} className={estiloCampo}>
                      <option value="retiro">Solo retiro en el local</option>
                      <option value="cotizado">Delivery: yo le digo el costo según la dirección</option>
                      <option value="tarifa">Delivery con tarifa fija</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    Tarifa fija en dólares (solo si elegiste tarifa fija)
                    <input name="delivery_tarifa_usd" inputMode="decimal" defaultValue={coma(config.delivery_tarifa_usd)} placeholder="2,00" className={`${estiloCampo} w-32!`} />
                  </label>
                  <label className="block text-sm">
                    Condiciones (zonas, horario del delivery…)
                    <textarea name="delivery_texto" rows={2} maxLength={300} defaultValue={config.delivery_texto} className={estiloCampo} />
                  </label>
                  <Boton>Guardar entregas</Boton>
                </FormAccion>
              </Seccion>
            </div>

            <Seccion id="avisos" titulo="Avisos y reseñas">
              <FormAccion conservar accion={actualizarAsistente} className="space-y-3">
                {oculto("avisos")}
                <label className="block text-sm">
                  WhatsApp donde te aviso de cada pedido (opcional)
                  <input name="telefono_dueno" inputMode="tel" defaultValue={config.telefono_dueno ?? ""} placeholder="584121234567" className={estiloCampo} />
                  <span className="text-xs text-muted">Vacío: te aviso en tu chat contigo mismo, en el WhatsApp del local.</span>
                </label>
                <div className="text-sm">
                  Si no atiendes un pedido nuevo, te lo recuerdo a los
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <input name="recordatorio_1_min" inputMode="numeric" aria-label="Primer recordatorio (minutos)" defaultValue={config.recordatorio_1_min ?? ""} className={campoCorto} />
                    y a los
                    <input name="recordatorio_2_min" inputMode="numeric" aria-label="Segundo recordatorio (minutos)" defaultValue={config.recordatorio_2_min ?? ""} className={campoCorto} />
                    minutos
                  </span>
                  <span className="text-xs text-muted">Vacío = sin ese recordatorio.</span>
                </div>
                <label className="block text-sm">
                  Enlace para dejar una reseña (Google Maps, Instagram…)
                  <input name="resena_url" type="url" defaultValue={config.resena_url ?? ""} placeholder="https://g.page/r/…" className={estiloCampo} />
                  <span className="text-xs text-muted">Vacío: no se piden reseñas.</span>
                </label>
                <label className="block text-sm">
                  Pedir la reseña después de entregar, a las
                  <select name="resena_espera_min" defaultValue={String(config.resena_espera_min)} className={`${estiloCampo} w-40!`}>
                    {[...new Set([...ESPERAS_RESENA, config.resena_espera_min])].sort((a, b) => a - b).map((m) => (
                      <option key={m} value={m}>{m % 60 === 0 ? `${m / 60} ${m === 60 ? "hora" : "horas"}` : `${m} minutos`}</option>
                    ))}
                  </select>
                </label>
                <Boton>Guardar avisos</Boton>
              </FormAccion>
            </Seccion>

            <Seccion id="avanzado" titulo="Más ajustes">
              <FormAccion conservar accion={actualizarAsistente} className="space-y-3">
                {oculto("avanzado")}
                <label className="block text-sm">
                  Decir «quedan pocas» cuando haya estas unidades o menos (0 = nunca)
                  <input name="stock_aviso_umbral" inputMode="numeric" defaultValue={config.stock_aviso_umbral} className={campoCorto} />
                </label>
                <label className="block text-sm">
                  Anticipación de los encargos (tortas, pedidos especiales), en horas
                  <input name="encargo_aviso_horas" inputMode="numeric" defaultValue={config.encargo_aviso_horas} className={campoCorto} />
                </label>
                <div className="text-sm">
                  Avísame para confirmar un pedido grande: desde
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    $<input name="pedido_grande_usd" inputMode="decimal" aria-label="Pedido grande desde (dólares)" defaultValue={coma(config.pedido_grande_usd)} className={campoCorto} />
                    o
                    <input name="pedido_grande_unidades" inputMode="numeric" aria-label="Pedido grande desde (unidades de un producto)" defaultValue={config.pedido_grande_unidades} className={campoCorto} />
                    unidades de un producto
                  </span>
                </div>
                <Boton>Guardar</Boton>
              </FormAccion>
            </Seccion>
          </div>
        </div>
      </Editable>
    </section>
  );
}
