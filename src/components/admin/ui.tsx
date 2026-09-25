"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { Estado } from "@/lib/validacion";

// Botón de envío: se desactiva mientras la acción está en curso.
export function Boton({
  children,
  variante = "primario",
  tamano = "normal",
  className = "",
}: {
  children: ReactNode;
  variante?: "primario" | "suave" | "peligro";
  tamano?: "normal" | "compacto";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const estilos = {
    primario: "bg-foreground text-background",
    suave: "border border-line hover:bg-surface",
    peligro: "bg-red-600 text-white",
  }[variante];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-full text-sm font-medium disabled:opacity-50 ${tamano === "compacto" ? "px-3 py-1.5" : "px-4 py-2.5"} ${estilos} ${className}`}
    >
      {pending ? "Guardando…" : children}
    </button>
  );
}

// Formulario con validación en el servidor: muestra el error o la confirmación que devuelva la acción.
export function FormAccion({
  accion,
  children,
  className = "",
}: {
  accion: (previo: Estado, datos: FormData) => Promise<Estado>;
  children: ReactNode;
  className?: string;
}) {
  const [estado, ejecutar] = useActionState(accion, {} as Estado);
  return (
    <form action={ejecutar} className={className}>
      {children}
      {estado.error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p role="status" className="mt-2 text-sm text-green-700 dark:text-green-400">
          {estado.ok}
        </p>
      )}
    </form>
  );
}
