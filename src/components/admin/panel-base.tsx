import type { ReactNode } from "react";
import type { Panel } from "@/lib/admin";

// Las pantallas del panel las usan el dueño (/admin) y el super admin (/superadmin/locales/[slug]).
// `superadmin` solo cambia los avisos y permisos; `base` es la ruta raíz del panel para armar enlaces.
export type Contexto = { superadmin: boolean; base: string };

export const tarjeta = "rounded-2xl border border-line p-4";

export function AvisoPausa({ panel, contexto }: { panel: Panel; contexto: Contexto }) {
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
export function Editable({ panel, contexto, children }: { panel: Panel; contexto: Contexto; children: ReactNode }) {
  const soloLectura = !panel.negocio.activo && !contexto.superadmin;
  return (
    <fieldset disabled={soloLectura} className="m-0 min-w-0 border-0 p-0">
      {children}
    </fieldset>
  );
}

export function Titulo({ children, descripcion }: { children: ReactNode; descripcion?: string }) {
  return (
    <div className="mb-5 print:hidden">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {descripcion && <p className="mt-1 text-sm text-muted">{descripcion}</p>}
    </div>
  );
}
