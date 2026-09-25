"use server";

import { obtenerSesion, requerirNegocio } from "@/lib/admin";
import { estadoInstancia, evolutionConfigurado, obtenerQR, type EstadoWhatsApp } from "@/lib/evolution";

// Lo que ve el navegador: nunca la instancia, la clave ni respuestas crudas de Evolution.
export type EstadoVinculo = {
  ok: boolean;
  estado?: EstadoWhatsApp | "sin_instancia" | "no_configurado";
  qr?: string | null;
  codigo?: string | null;
  error?: string;
};

const NO_CONFIGURADO: EstadoVinculo = {
  ok: false,
  estado: "no_configurado",
  error: "La conexión con WhatsApp no está configurada en el servidor.",
};

// La instancia sale SIEMPRE de la base de datos, del local de la sesión (el dueño) o del local elegido
// (el super admin): jamás de un campo del formulario. Así nadie puede pedir el QR de otro local.
async function instanciaDelLocal(
  supabase: Awaited<ReturnType<typeof requerirNegocio>>["supabase"],
  negocioId: string,
): Promise<string | null> {
  const { rol } = await obtenerSesion();
  const { data, error } =
    rol === "superadmin"
      ? await supabase.rpc("instancia_evolution_de", { p_negocio: negocioId })
      : await supabase.rpc("mi_instancia_evolution");
  if (error) throw new Error(`No se pudo leer la instancia de WhatsApp: ${error.message}`);
  return (data as string | null) ?? null;
}

// Estado de la conexión (conectado / desconectado / conectando).
export async function consultarWhatsApp(datos: FormData): Promise<EstadoVinculo> {
  const { supabase, negocioId } = await requerirNegocio(datos); // la sesión, siempre lo primero
  if (!evolutionConfigurado()) return NO_CONFIGURADO;
  const instancia = await instanciaDelLocal(supabase, negocioId);
  if (!instancia) return { ok: true, estado: "sin_instancia" };

  const r = await estadoInstancia(instancia);
  return r.ok ? { ok: true, estado: r.valor } : { ok: false, error: r.mensaje };
}

// Pide un QR nuevo para (re)vincular. Si ya está conectada, devuelve solo el estado.
export async function pedirQR(datos: FormData): Promise<EstadoVinculo> {
  const { supabase, negocioId } = await requerirNegocio(datos); // la sesión, siempre lo primero
  if (!evolutionConfigurado()) return NO_CONFIGURADO;
  const instancia = await instanciaDelLocal(supabase, negocioId);
  if (!instancia) return { ok: true, estado: "sin_instancia" };

  const r = await obtenerQR(instancia);
  return r.ok ? { ok: true, estado: r.valor.estado, qr: r.valor.qr, codigo: r.valor.codigo } : { ok: false, error: r.mensaje };
}
