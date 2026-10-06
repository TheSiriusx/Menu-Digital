import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cambiarEstado, cambiarPlan, crearLocal, quitarDueno, reintentarWhatsApp, vincularDueno } from "@/app/superadmin/actions";
import { CampoNegocio } from "@/components/admin/campo-negocio";
import { estiloCampo } from "@/components/admin/estilos";
import { iniciales } from "@/components/admin/marco-panel";
import { Boton, FormAccion } from "@/components/admin/ui";
import { Icono, type NombreIcono } from "@/components/iconos";
import { AbrirNuevoLocal } from "@/components/superadmin/interactivos";
import { tarjetaSa } from "@/components/superadmin/marco";
import { esColorHex } from "@/lib/color";
import { etiquetaPlan, etiquetaTipo, PLANES, TIPOS } from "@/lib/tipos";

export type LocalSa = {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  plan: string;
  activo: boolean;
  productos: number;
  duenos: string[];
  instancia: string | null;
  telefono_whatsapp: string | null;
  logo_url: string | null;
  color: string | null;
};
// Métricas de un local (función metricas_locales). null = todavía sin datos o la consulta falló.
export type MetricasLocal = { visitas: number; pedidos: number; ventas_usd: number; respuestas: number; respuesta_mediana_s: number | null };

// Igual que `normalizar` en interactivos.tsx: lo que se escribe en el buscador se compara con esto.
const paraBuscar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function tiempoLegible(segundos: number | null | undefined): string | null {
  if (segundos === null || segundos === undefined) return null;
  if (segundos < 60) return `${Math.round(segundos)} s`;
  if (segundos < 3600) return `${(segundos / 60).toFixed(1).replace(".", ",").replace(",0", "")} min`;
  return `${(segundos / 3600).toFixed(1).replace(".", ",").replace(",0", "")} h`;
}

function Pastilla({ tono, children, dataEstado }: { tono: "exito" | "aviso" | "neutro" | "acento"; children: ReactNode; dataEstado?: boolean }) {
  const estilos = {
    exito: "bg-exito-suave text-exito",
    aviso: "bg-aviso-suave text-aviso",
    neutro: "bg-surface text-muted",
    acento: "bg-(--acento-suave) text-(--acento-texto)",
  }[tono];
  return (
    <span data-estado={dataEstado ? "" : undefined} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${estilos}`}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------- cifras de arriba
function Indicador({ titulo, icono, valor, valorClase = "", pastilla, pie }: { titulo: string; icono: NombreIcono; valor: ReactNode; valorClase?: string; pastilla?: ReactNode; pie: string }) {
  return (
    <div className={`${tarjetaSa} flex flex-col justify-between p-4 transition-shadow hover:shadow-(--sombra-2) lg:p-5`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11.5px] font-semibold tracking-[0.06em] text-muted uppercase">{titulo}</span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-(--acento-texto)"><Icono nombre={icono} tamano={18} /></span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className={`font-titulo text-[26px] leading-8 font-bold tracking-tight lg:text-[30px] ${valorClase}`}>{valor}</span>
        {pastilla}
      </div>
      <p className="mt-1.5 text-xs text-muted">{pie}</p>
    </div>
  );
}

export function Indicadores({ locales }: { locales: LocalSa[] }) {
  const total = locales.length;
  const activos = locales.filter((l) => l.activo).length;
  const productos = locales.reduce((s, l) => s + l.productos, 0);
  const conWhatsApp = locales.filter((l) => l.instancia).length;
  const sinDueno = locales.filter((l) => l.duenos.length === 0).length;
  const pct = total ? Math.round((activos / total) * 100) : 0;
  return (
    <section aria-label="Resumen de locales" className="mb-7 grid grid-cols-2 gap-3 lg:gap-4 xl:grid-cols-4">
      <Indicador titulo="Total locales" icono="tienda" valor={total} pastilla={total > 0 && <Pastilla tono={pct === 100 ? "exito" : "aviso"}>{pct}% activos</Pastilla>} pie={`${activos} activo${activos === 1 ? "" : "s"} · ${total - activos} pausado${total - activos === 1 ? "" : "s"}`} />
      <Indicador titulo="Productos en menús" icono="cubiertos" valor={productos} pie={`En ${total} menú${total === 1 ? "" : "s"}`} />
      <Indicador
        titulo="WhatsApp"
        icono="chat"
        valor={`${conWhatsApp}/${total}`}
        valorClase={total > 0 && conWhatsApp === total ? "text-exito" : ""}
        pastilla={total > 0 && (conWhatsApp === total ? <Pastilla tono="exito">Al día</Pastilla> : <Pastilla tono="aviso">Pendiente</Pastilla>)}
        pie="Locales con cuenta de WhatsApp creada"
      />
      <Indicador
        titulo="Dueños"
        icono="persona"
        valor={sinDueno}
        valorClase={sinDueno > 0 ? "text-(--acento-texto)" : ""}
        pastilla={total > 0 && (sinDueno > 0 ? <Pastilla tono="acento">Pendiente</Pastilla> : <Pastilla tono="exito">Al día</Pastilla>)}
        pie={sinDueno === 1 ? "Local sin dueño vinculado" : "Locales sin dueño vinculado"}
      />
    </section>
  );
}

// ---------------------------------------------------------------- nuevo local
const boton = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all active:scale-[0.98]";
export const botonPrimario = `${boton} bg-(--acento) text-(--sobre-acento) shadow-(--sombra-1) hover:bg-(--acento-texto)`;
export const botonSecundario = `${boton} border border-[#e2ddd5] bg-card text-foreground hover:border-(--acento) hover:text-(--acento-texto)`;

export function BotonNuevoLocal() {
  return (
    <AbrirNuevoLocal className={botonPrimario}>
      <Icono nombre="mas" tamano={18} />
      Nuevo local
    </AbrirNuevoLocal>
  );
}

// Formulario de alta: un <details> que abren el botón del encabezado y la tarjeta «Agregar» (cerrado no ocupa lugar).
export function PanelNuevoLocal() {
  return (
    <section aria-labelledby="nuevo" className="scroll-mt-24">
      <details id="panel-nuevo-local" className={`group mb-7 not-open:hidden ${tarjetaSa} p-5 lg:p-6`}>
        <summary id="nuevo" className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <span className="font-titulo text-[17px] font-semibold">Nuevo local</span>
          <span className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:bg-surface">Cerrar</span>
        </summary>
        <FormAccion accion={crearLocal} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-[13px] font-semibold">
            Nombre
            <input name="nombre" required maxLength={80} className={`${estiloCampo} mt-1.5 bg-card!`} />
          </label>
          <label className="block text-[13px] font-semibold">
            Enlace (opcional)
            <input name="slug" maxLength={60} placeholder="la-espiga" className={`${estiloCampo} mt-1.5 bg-card!`} />
            <span className="mt-1 block text-xs font-normal text-muted">Vacío = se genera del nombre. No se puede cambiar después.</span>
          </label>
          <label className="block text-[13px] font-semibold">
            Tipo
            <select name="tipo" defaultValue="panaderia" className={`${estiloCampo} mt-1.5 bg-card!`}>
              {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
            </select>
          </label>
          <label className="block text-[13px] font-semibold">
            Plan
            <select name="plan" defaultValue="basico" className={`${estiloCampo} mt-1.5 bg-card!`}>
              {PLANES.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2"><Boton>Crear local</Boton></div>
        </FormAccion>
      </details>
    </section>
  );
}

export function TarjetaAgregar() {
  return (
    <li data-agregar className="list-none">
      <AbrirNuevoLocal className="group flex h-full min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#e2ddd5] bg-surface/60 p-8 text-center transition-all hover:border-(--acento) hover:bg-card hover:shadow-(--sombra-2)">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-(--acento-texto) shadow-(--sombra-1) transition-transform group-hover:scale-110">
          <Icono nombre="tiendaMas" tamano={28} />
        </span>
        <span className="font-titulo text-[16px] font-semibold">Agregar un nuevo local</span>
        <span className="mt-1.5 max-w-xs text-[13px] text-muted">Crea su menú con enlace propio, su QR y su cuenta de WhatsApp.</span>
      </AbrirNuevoLocal>
    </li>
  );
}

// ---------------------------------------------------------------- tarjeta de cada local
function Bloque({ icono, tono = "acento", titulo, children, accion, aviso = false }: { icono: NombreIcono; tono?: "acento" | "exito"; titulo: string; children: ReactNode; accion?: ReactNode; aviso?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl p-3.5 ${aviso ? "bg-(--acento-suave)" : "bg-surface"}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card ${tono === "exito" ? "text-exito" : "text-(--acento-texto)"}`}>
          <Icono nombre={icono} tamano={19} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted">{titulo}</p>
          {children}
        </div>
      </div>
      {accion}
    </div>
  );
}

function Cifra({ icono, titulo, valor }: { icono: NombreIcono; titulo: string; valor: string | null }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-center">
      <Icono nombre={icono} tamano={18} className="text-(--acento-texto)" />
      <p className={valor === null ? "text-[12px] leading-5 text-muted" : "font-titulo text-[17px] leading-5 font-bold"}>{valor ?? "Sin datos aún"}</p>
      <p className="text-[11px] leading-tight text-muted">{titulo}</p>
    </div>
  );
}

export function TarjetaLocal({ local: l, hoy, semana }: { local: LocalSa; hoy: MetricasLocal | null; semana: MetricasLocal | null }) {
  const color = esColorHex(l.color) ? l.color : "#c45a38";
  const banda: CSSProperties = { background: `linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 45%, #fbf9f5) 100%)` };
  const filtros = [l.activo ? "activos" : "pausados", l.instancia ? "" : "whatsapp-pendiente", l.duenos.length ? "" : "sin-dueno"].filter(Boolean).join(" ");
  const respuesta = semana && semana.respuestas > 0 ? tiempoLegible(semana.respuesta_mediana_s) : null;

  return (
    <li
      data-local={l.slug}
      data-buscar={paraBuscar(`${l.nombre} ${l.slug} ${l.telefono_whatsapp ?? ""} ${etiquetaTipo(l.tipo)}`)}
      data-filtros={filtros}
      className={`${tarjetaSa} list-none overflow-hidden transition-shadow hover:shadow-(--sombra-2)`}
    >
      {/* Cabecera con el color del local (en vista de lista se oculta) */}
      <div style={banda} className="relative h-24 group-data-[vista=lista]/locales:hidden">
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card/95 px-2.5 py-1 text-[11.5px] font-semibold shadow-(--sombra-1)">
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${l.activo ? "bg-exito" : "bg-aviso"}`} />
            <span data-estado className={l.activo ? "text-exito" : "text-aviso"}>{l.activo ? "Activo" : "Pausado"}</span>
          </span>
          <span className="rounded-full bg-card/95 px-2.5 py-1 text-[11.5px] font-semibold text-(--acento-texto) shadow-(--sombra-1)">Plan {etiquetaPlan(l.plan)}</span>
        </div>
      </div>

      <div className="p-5 lg:p-6">
        <div className="relative z-10 flex items-start gap-3.5 group-data-[vista=tarjetas]/locales:-mt-12">
          {l.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.logo_url} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-xl border-2 border-card bg-card object-cover shadow-(--sombra-1)" />
          ) : (
            <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-card bg-(--acento-suave) font-titulo text-lg font-bold text-(--acento-texto) shadow-(--sombra-1)">
              {iniciales(l.nombre)}
            </span>
          )}
          <div className="min-w-0 flex-1 group-data-[vista=tarjetas]/locales:pt-12">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-titulo text-[18px] leading-tight font-semibold">{l.nombre}</h2>
              <span className="rounded-md bg-surface px-2 py-0.5 text-xs text-muted">{etiquetaTipo(l.tipo)}</span>
              <span className="hidden items-center gap-1.5 text-[11.5px] font-semibold group-data-[vista=lista]/locales:inline-flex">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${l.activo ? "bg-exito" : "bg-aviso"}`} />
                {l.activo ? "Activo" : "Pausado"} · Plan {etiquetaPlan(l.plan)}
              </span>
            </div>
            <Link href={`/${l.slug}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-(--acento-texto) hover:underline">
              <Icono nombre="enlace" tamano={14} />
              /{l.slug}
              <Icono nombre="externo" tamano={13} />
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Bloque icono="libro" titulo="Menú">
            <p className="text-[13.5px] font-semibold">{l.productos} producto{l.productos === 1 ? "" : "s"}</p>
          </Bloque>
          <Bloque
            icono="chat"
            tono={l.instancia ? "exito" : "acento"}
            titulo="Canal de WhatsApp"
            aviso={!l.instancia}
          >
            <p className="truncate text-[13.5px] font-semibold" data-whatsapp={l.instancia ? "listo" : "pendiente"}>
              {l.instancia ?? "Pendiente"}
            </p>
            <p className={`mt-0.5 flex items-center gap-1 text-xs ${l.instancia ? "text-exito" : "text-(--acento-texto)"}`}>
              <Icono nombre={l.instancia ? "check" : "alerta"} tamano={13} />
              {l.instancia ? "Cuenta creada" : "Falta crear la cuenta"}
            </p>
          </Bloque>
          <div className="md:col-span-2">
            <Bloque
              icono="persona"
              titulo="Dueño"
              aviso={l.duenos.length === 0}
            >
              {l.duenos.length > 0 ? (
                <p className="text-[13.5px] font-semibold break-all">{l.duenos.join(", ")}</p>
              ) : (
                <p className="flex items-center gap-1 text-[13.5px] font-semibold text-(--acento-texto)">
                  <Icono nombre="alerta" tamano={14} />
                  Sin vincular todavía
                </p>
              )}
            </Bloque>
          </div>
        </div>

        {/* Métricas reales: hoy y, el tiempo de respuesta, de los últimos 7 días */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-line px-2 py-3">
          <Cifra icono="ojo" titulo="Visitas hoy" valor={hoy ? String(hoy.visitas) : null} />
          <Cifra icono="enviar" titulo="Pedidos WhatsApp hoy" valor={hoy ? String(hoy.pedidos) : null} />
          <Cifra icono="reloj" titulo="Respuesta (7 días)" valor={respuesta} />
        </div>

        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <Link href={`/superadmin/locales/${l.slug}`} className={`${botonPrimario} sm:flex-1`}>
            Administrar menú
            <Icono nombre="flecha" tamano={16} />
          </Link>
          <Link href={`/${l.slug}`} target="_blank" rel="noopener noreferrer" className={botonSecundario}>
            <Icono nombre="ojo" tamano={18} className="text-muted" />
            Ver carta online
          </Link>
        </div>

        {/* Gestión rápida: estado, plan, WhatsApp y dueño (las mismas acciones de siempre) */}
        <details className="group/gestion mt-4 rounded-xl bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Icono nombre="ajustes" tamano={18} className="text-(--acento-texto)" />
              Gestión rápida · Estado, plan y dueño
            </span>
            <Icono nombre="chevron" tamano={16} className="text-muted transition-transform group-open/gestion:rotate-90" />
          </summary>
          <div className="space-y-4 px-4 pb-4">
            {!l.instancia && (
              <FormAccion accion={reintentarWhatsApp} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-3">
                <CampoNegocio id={l.id} />
                <span className="text-[13px]">La cuenta de WhatsApp no se pudo crear al dar de alta el local.</span>
                <Boton variante="suave">Crear cuenta de WhatsApp</Boton>
              </FormAccion>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card p-3">
              <div>
                <p className="text-[13px] font-semibold">Operación del local</p>
                <p className="text-xs text-muted">{l.activo ? "Activo: los clientes ven su menú." : "Pausado: menú no disponible y dueño en solo lectura."}</p>
              </div>
              {l.activo ? (
                <details className="w-full sm:w-auto">
                  <summary className="cursor-pointer list-none text-[13px] font-semibold text-aviso [&::-webkit-details-marker]:hidden">Pausar local (impago)</summary>
                  <form action={cambiarEstado} className="mt-2">
                    <CampoNegocio id={l.id} />
                    <input type="hidden" name="activo" value="false" />
                    <p className="mb-2 text-xs text-muted">Los clientes verán «menú no disponible» y el dueño quedará en solo lectura.</p>
                    <Boton variante="peligro" tamano="compacto">Sí, pausar</Boton>
                  </form>
                </details>
              ) : (
                <form action={cambiarEstado}>
                  <CampoNegocio id={l.id} />
                  <input type="hidden" name="activo" value="true" />
                  <Boton tamano="compacto">Reactivar local</Boton>
                </form>
              )}
            </div>

            <FormAccion accion={cambiarPlan} className="flex flex-wrap items-end gap-2 rounded-lg bg-card p-3">
              <CampoNegocio id={l.id} />
              <label className="flex-1 text-[13px] font-semibold">
                Plan
                <select name="plan" defaultValue={l.plan} aria-label="Plan" className={`${estiloCampo} mt-1.5`}>
                  {PLANES.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
                </select>
              </label>
              <Boton variante="suave">Guardar plan</Boton>
            </FormAccion>

            <div className="rounded-lg bg-card p-3">
              <FormAccion accion={vincularDueno} className="flex flex-wrap items-end gap-2">
                <CampoNegocio id={l.id} />
                <label className="min-w-0 flex-1 text-[13px] font-semibold">
                  Vincular correo del dueño
                  <input name="correo" type="email" required aria-label="Correo del dueño" placeholder="dueño@correo.com" className={`${estiloCampo} mt-1.5`} />
                </label>
                <Boton variante="suave">Vincular dueño</Boton>
              </FormAccion>
              <p className="mt-1.5 text-xs text-muted">La cuenta debe existir ya en Supabase (Authentication → Users).</p>
              {l.duenos.map((correo) => (
                <form key={correo} action={quitarDueno} className="mt-2 flex items-center justify-between gap-2 text-[13px]">
                  <CampoNegocio id={l.id} />
                  <input type="hidden" name="correo" value={correo} />
                  <span className="truncate">{correo}</span>
                  <Boton variante="suave" tamano="compacto">Quitar</Boton>
                </form>
              ))}
            </div>
          </div>
        </details>
      </div>
    </li>
  );
}
