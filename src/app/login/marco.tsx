import type { ReactNode } from "react";
import { AvisoInstalar } from "@/components/pwa/aviso-instalar";
import { Logo } from "@/components/brand/Logo";
import { ESLOGAN, FIRMA } from "@/lib/marca";

// Pantalla de acceso (login, recuperar y cambiar contraseña, verificación). Computadora: panel azul de marca a la
// izquierda (imagotipo reverso y eslogan en accent) y el formulario a la derecha. Celular: isologo arriba y el
// formulario en una tarjeta surface-200 con la forma de marca.
export function MarcoAcceso({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 bg-surface-100">
      <div className="hidden flex-1 flex-col justify-between bg-brand p-[52px] text-accent lg:flex">
        <Logo variant="imagotipo" tone="reverso" width={168} className="-m-2" />
        <div className="max-w-[420px]">
          <p className="font-display text-display text-accent">{ESLOGAN}</p>
          <p className="mt-4 text-body-lg text-accent">
            Tu menú con enlace y QR, los pedidos por WhatsApp y precios en dólares y bolívares, desde el celular o la computadora.
          </p>
        </div>
        <p className="border-t border-accent/30 pt-5 text-caption text-accent">{FIRMA}</p>
      </div>

      <main className="flex w-full flex-col items-center justify-center gap-6 px-4 py-10 lg:w-[520px] lg:shrink-0 lg:px-12">
        <Logo variant="isologo" width={72} className="lg:hidden" />
        <div className="w-full max-w-[420px] rounded-brand border border-line bg-surface-200 p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-title text-ink">{titulo}</h1>
            <p className="mt-2 text-[14.5px] text-ink-muted">{descripcion}</p>
          </div>
          {children}
        </div>
        <AvisoInstalar className="w-full max-w-[420px]" />
        <p className="text-caption text-ink-muted lg:hidden">{FIRMA}</p>
      </main>
    </div>
  );
}
