import type { ReactNode } from "react";
import { EMPRESA, MARCA } from "@/lib/marca";

// Pantalla dividida del acceso: panel de marca a la izquierda (se oculta en el celular) y el formulario a la derecha.
export function MarcoAcceso({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 bg-background">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[#241c16] p-[52px] text-[#f5f1ea] lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(560px_420px_at_15%_85%,rgb(201_106_59/0.35),transparent_70%)]" />
        <p className="relative flex items-center gap-2.5 font-titulo text-base font-semibold tracking-[0.01em]">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[#c96a3b]" />
          {MARCA}
          <span className="font-sans text-[13px] font-normal text-[#b5aa98]">by {EMPRESA}</span>
        </p>
        <div className="relative max-w-[380px]">
          <p className="mb-3.5 font-titulo text-[34px] font-medium leading-[1.25]">Tu menú, tus pedidos, sin depender de nadie.</p>
          <p className="text-[14.5px] leading-relaxed text-[#d8d0c4]">
            Entra a tu panel para editar precios, marcar productos agotados, ver tus pedidos y tu menú tal como lo ve tu cliente, desde el celular o la computadora.
          </p>
        </div>
        <p className="relative border-t border-[#f5f1ea]/15 pt-5 text-[13px] text-[#b5aa98]">Pedidos por WhatsApp desde el menú de tu negocio.</p>
      </div>

      <main className="flex w-full flex-col justify-center bg-card px-6 py-10 lg:w-[460px] lg:shrink-0 lg:px-14">
        <div className="mb-7">
          {/* eslint-disable-next-line @next/next/no-img-element -- ícono fijo del producto (src/app/icon.svg) */}
          <img src="/icon.svg" alt="" width={44} height={44} className="mb-4.5 h-11 w-11 rounded-xl" />
          <h1 className="text-[23px] leading-tight">{titulo}</h1>
          <p className="mt-2 text-[13.5px] text-muted">{descripcion}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
