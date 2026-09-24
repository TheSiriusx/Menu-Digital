"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Estado } from "@/lib/validacion";

export async function iniciarSesion(_previo: Estado, datos: FormData): Promise<Estado> {
  const correo = String(datos.get("correo") ?? "").trim().toLowerCase();
  const clave = String(datos.get("clave") ?? "");
  if (!correo || !clave) return { error: "Escribe tu correo y tu contraseña." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave });

  // Mensaje único: no revela si el correo existe. Supabase ya limita los intentos repetidos.
  if (error) return { error: "Correo o contraseña incorrectos." };

  redirect("/admin");
}
