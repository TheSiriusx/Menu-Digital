"use client";

import { useActionState, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { iniciarSesion } from "@/app/login/actions";
import { botonPrimario } from "@/components/admin/estilos";
import type { Estado } from "@/lib/validacion";

const campo = (conError: boolean) =>
  `w-full rounded-[10px] border px-3.5 py-3 text-base text-ink transition-[border-color,box-shadow] focus:outline-none focus:ring-3 ${
    conError ? "border-danger bg-danger/10 focus:ring-danger/15" : "border-line bg-surface-100 focus:border-brand-text focus:ring-brand-text/20"
  }`;

function BotonEntrar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${botonPrimario} mt-1.5 w-full`}
    >
      {pending && <span aria-hidden="true" className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-accent/50 border-t-accent" />}
      <span className={pending ? "opacity-85" : ""}>{pending ? "Entrando…" : "Entrar"}</span>
    </button>
  );
}

// El inicio de sesión se hace en el servidor (iniciarSesion): la sesión queda en cookies protegidas y, si la
// cuenta tiene verificación en dos pasos, se pide el código. Aquí solo va la validación rápida y la presentación.
export function FormularioAcceso() {
  const [estado, ejecutar] = useActionState(iniciarSesion, {} as Estado);
  const [errores, setErrores] = useState({ correo: false, clave: false });
  const [verClave, setVerClave] = useState(false);
  const [ocultarAviso, setOcultarAviso] = useState(false);

  function validar(e: FormEvent<HTMLFormElement>) {
    const datos = new FormData(e.currentTarget);
    const nuevos = {
      correo: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(datos.get("correo") ?? "").trim()),
      clave: String(datos.get("clave") ?? "").trim().length === 0,
    };
    setErrores(nuevos);
    setOcultarAviso(false);
    if (nuevos.correo || nuevos.clave) e.preventDefault();
  }

  return (
    <form action={ejecutar} onSubmit={validar} noValidate className="flex flex-col gap-4" onInput={() => setOcultarAviso(true)}>
      {estado.error && !ocultarAviso && (
        <p role="alert" className="flex items-center gap-2 rounded-[10px] bg-danger/10 px-3.5 py-3 text-[13px] font-medium text-danger">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
          {estado.error}
        </p>
      )}

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold">Correo</span>
        <input name="correo" type="email" autoComplete="username" placeholder="tunegocio@correo.com" className={campo(errores.correo)} aria-invalid={errores.correo || undefined} />
        {errores.correo && <span className="mt-1.5 block text-xs text-danger">Escribe un correo válido.</span>}
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold">Contraseña</span>
        <span className="relative block">
          <input
            name="clave"
            type={verClave ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            className={`${campo(errores.clave)} pr-11`}
            aria-invalid={errores.clave || undefined}
          />
          <button
            type="button"
            onClick={() => setVerClave(!verClave)}
            aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-muted hover:bg-line"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
              <circle cx="12" cy="12" r="3" />
              {verClave && <path d="M3 3l18 18" />}
            </svg>
          </button>
        </span>
        {errores.clave && <span className="mt-1.5 block text-xs text-danger">Escribe tu contraseña.</span>}
      </label>

      <BotonEntrar />
    </form>
  );
}
