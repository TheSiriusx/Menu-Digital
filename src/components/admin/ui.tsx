"use client";

import { createContext, startTransition, useActionState, useContext, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { Estado } from "@/lib/validacion";

// Envío en curso de un FormAccion con `conservar` (ahí useFormStatus no se entera).
const EnCurso = createContext(false);

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
  const { pending: enviando } = useFormStatus();
  const enCurso = useContext(EnCurso);
  const pending = enviando || enCurso;
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
// Con `conservar`, el formulario NO se vacía después de enviarlo (React lo hace por defecto): en formularios de
// configuración, un error de validación no debe borrar lo que el dueño acaba de escribir.
export function FormAccion({
  accion,
  children,
  className = "",
  conservar = false,
}: {
  accion: (previo: Estado, datos: FormData) => Promise<Estado>;
  children: ReactNode;
  className?: string;
  conservar?: boolean;
}) {
  const [estado, ejecutar, pendiente] = useActionState(accion, {} as Estado);
  const alEnviar = conservar
    ? (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        startTransition(() => ejecutar(datos));
      }
    : undefined;
  return (
    <form action={conservar ? undefined : ejecutar} onSubmit={alEnviar} aria-busy={pendiente || undefined} className={className}>
      <EnCurso.Provider value={pendiente}>{children}</EnCurso.Provider>
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
