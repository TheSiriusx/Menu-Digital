"use client";

import { useActionState, useTransition } from "react";
import { confirmarInscripcion, iniciarInscripcion } from "@/app/superadmin/mfa/actions";
import { estiloCampo } from "@/components/admin/estilos";
import { Boton, FormAccion } from "@/components/admin/ui";
import type { EstadoInscripcion } from "@/lib/mfa";

// Inscripción en dos pasos: 1) mostrar el QR y el código secreto, 2) confirmar con el primer código.
export function InscribirMfa() {
  const [inscripcion, iniciar] = useActionState<EstadoInscripcion>(iniciarInscripcion, {});
  const [ocupado, empezar] = useTransition();

  if (!inscripcion.factorId) {
    return (
      <div>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => empezar(() => iniciar())}
          className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background disabled:opacity-50"
        >
          {ocupado ? "Preparando…" : "Activar verificación en dos pasos"}
        </button>
        {inscripcion.error && (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
            {inscripcion.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
        <li>Abre tu app autenticadora (Google Authenticator, Authy, Microsoft Authenticator…).</li>
        <li>Agrega una cuenta nueva y escanea este QR.</li>
        <li>Escribe abajo el código de 6 dígitos que te muestre.</li>
      </ol>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={inscripcion.qr} alt="Código QR para tu app autenticadora" width={200} height={200} className="h-48 w-48 rounded-xl border border-line bg-white p-2" />

      <div className="rounded-xl border border-line bg-surface p-3">
        <p className="text-sm font-medium">Código secreto de respaldo</p>
        <p data-secreto className="mt-1 break-all font-mono text-sm tracking-wide">{inscripcion.secreto}</p>
        <p className="mt-2 text-xs text-muted">
          Guárdalo en tu gestor de contraseñas. Si pierdes el celular, es la única forma de recuperar este acceso.
        </p>
      </div>

      <FormAccion accion={confirmarInscripcion} className="space-y-3">
        <input type="hidden" name="factorId" value={inscripcion.factorId} />
        <label className="block text-sm font-medium">
          Primer código
          <input
            name="codigo"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            className={`mt-1 ${estiloCampo} max-w-48 text-center text-xl tracking-[0.4em] tabular-nums`}
          />
        </label>
        <Boton>Confirmar y activar</Boton>
      </FormAccion>
    </div>
  );
}
