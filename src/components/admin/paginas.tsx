import { VistaClientes } from "@/components/admin/vista-clientes";
import { VistaDashboard } from "@/components/admin/vista-dashboard";
import { VistaPedidos } from "@/components/admin/vista-pedidos";
import { VistaConfiguracion, VistaMenu } from "@/components/admin/vistas";
import type { Contexto } from "@/components/admin/panel-base";
import type { Panel } from "@/lib/admin";
import { hoyCaracas } from "@/lib/fechas";
import { cargarAsistente, cargarClientes, cargarDashboard, cargarPedidos, leerFiltrosDashboard, leerFiltrosPedidos } from "@/lib/panel-datos";

// Las cinco pantallas con sus datos. Las rutas del dueño (/admin/*) y las del super admin
// (/superadmin/locales/[slug]/*) son envoltorios de una línea sobre estas.
export type Params = Record<string, string | string[] | undefined>;
type Props = { panel: Panel; contexto: Contexto };

export async function PaginaDashboard({ panel, contexto, params }: Props & { params: Params }) {
  const { vista, topDias } = leerFiltrosDashboard(params);
  const datos = await cargarDashboard(panel.negocio.id, vista, topDias);
  return <VistaDashboard panel={panel} datos={datos} contexto={contexto} />;
}

export function PaginaMenu({ panel, contexto }: Props) {
  return <VistaMenu panel={panel} contexto={contexto} />;
}

export async function PaginaPedidos({ panel, contexto, params }: Props & { params: Params }) {
  const filtros = leerFiltrosPedidos(params);
  const { pedidos, total } = await cargarPedidos(panel.negocio.id, filtros);
  return <VistaPedidos panel={panel} pedidos={pedidos} total={total} filtros={filtros} contexto={contexto} />;
}

export async function PaginaClientes({ panel, contexto, params }: Props & { params: Params }) {
  const clientes = await cargarClientes(panel.negocio.id);
  const r = params.recurrentes;
  const soloRecurrentes = (Array.isArray(r) ? r[0] : r) === "1";
  return <VistaClientes panel={panel} clientes={clientes} soloRecurrentes={soloRecurrentes} anioActual={hoyCaracas().slice(0, 4)} contexto={contexto} />;
}

export async function PaginaConfiguracion({ panel, contexto }: Props) {
  const asistente = await cargarAsistente(panel.negocio.id);
  return <VistaConfiguracion panel={panel} asistente={asistente} contexto={contexto} />;
}
