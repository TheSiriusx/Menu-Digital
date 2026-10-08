import Link from "next/link";
import { Icono } from "@/components/iconos";
import { FiltroLocales } from "@/components/superadmin/interactivos";
import {
  BotonNuevoLocal,
  botonSecundario,
  Indicadores,
  PanelNuevoLocal,
  TarjetaAgregar,
  TarjetaLocal,
  type LocalSa,
  type MetricasLocal,
} from "@/components/superadmin/locales";
import { EncabezadoPagina } from "@/components/superadmin/marco";
import { requerirSuperadmin } from "@/lib/admin";
import { hoyCaracas, sumarDias } from "@/lib/fechas";

export const metadata = { title: "Super admin — Locales" };

type FilaMetricas = MetricasLocal & { negocio_id: string };

export default async function Locales() {
  const { supabase } = await requerirSuperadmin();
  const hoy = hoyCaracas();
  const [lista, extras, mHoy, mSemana] = await Promise.all([
    supabase.rpc("listar_negocios"),
    supabase.from("negocios").select("id, telefono_whatsapp, logo_url, color"),
    supabase.rpc("metricas_locales", { p_desde: hoy, p_hasta: hoy }),
    supabase.rpc("metricas_locales", { p_desde: sumarDias(hoy, -6), p_hasta: hoy }),
  ]);
  if (lista.error) throw new Error(`No se pudieron listar los locales: ${lista.error.message}`);

  const porId = new Map((extras.data ?? []).map((n) => [n.id as string, n]));
  const locales: LocalSa[] = ((lista.data ?? []) as Omit<LocalSa, "telefono_whatsapp" | "logo_url" | "color">[]).map((l) => ({
    ...l,
    telefono_whatsapp: (porId.get(l.id)?.telefono_whatsapp as string | null) ?? null,
    logo_url: (porId.get(l.id)?.logo_url as string | null) ?? null,
    color: (porId.get(l.id)?.color as string | null) ?? null,
  }));
  // Si las métricas fallan, el panel sigue funcionando y las cifras dicen «Sin datos aún».
  const metricas = (r: { data: unknown; error: unknown }) =>
    new Map(r.error ? [] : ((r.data ?? []) as FilaMetricas[]).map((m) => [m.negocio_id, { ...m, visitas: Number(m.visitas), pedidos: Number(m.pedidos), respuestas: Number(m.respuestas), ventas_usd: Number(m.ventas_usd), respuesta_mediana_s: m.respuesta_mediana_s === null ? null : Number(m.respuesta_mediana_s) }]));
  const hoyPorLocal = metricas(mHoy);
  const semanaPorLocal = metricas(mSemana);

  return (
    <>
      <EncabezadoPagina
        titulo="Locales"
        etiqueta={`${locales.length} registrado${locales.length === 1 ? "" : "s"}`}
        descripcion="Administra los locales, sus menús, la asignación de dueños y la vinculación con WhatsApp."
        acciones={
          <>
            <Link href="/superadmin/reporte" prefetch={false} className={botonSecundario}>
              <Icono nombre="descarga" tamano={18} />
              Reporte
            </Link>
            <BotonNuevoLocal />
          </>
        }
      />

      <PanelNuevoLocal />
      <Indicadores locales={locales} />

      <FiltroLocales>
        <ul aria-label="Lista de locales" className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2 lg:gap-6 group-data-[vista=lista]/locales:lg:grid-cols-1">
          {locales.map((l) => (
            <TarjetaLocal key={l.id} local={l} hoy={hoyPorLocal.get(l.id) ?? null} semana={semanaPorLocal.get(l.id) ?? null} />
          ))}
          <TarjetaAgregar />
        </ul>
        <p data-sin-resultados hidden className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          Ningún local coincide con la búsqueda.
        </p>
      </FiltroLocales>
    </>
  );
}
