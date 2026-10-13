import type { Metadata } from "next";
import { botonPrimario } from "@/components/admin/estilos";

export const metadata: Metadata = { title: "Sin conexión", robots: { index: false } };

// La muestra el service worker (public/sw.js) cuando no hay señal y la página pedida no estaba guardada. Se guarda al
// instalar la app, así que no puede depender de datos ni de la sesión, y funciona sin JavaScript: «Reintentar» es un
// enlace a la misma dirección.
export default function SinConexion() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- copia con versión del isotipo, guardada para verse sin señal */}
      <img src="/pwa/sin-conexion-isotipo-v1.svg" alt="" width={56} height={56} className="mb-2" />
      <h1 className="text-title text-ink">Sin conexión</h1>
      <p className="max-w-sm text-ink-muted">Revisa tu internet. Cuando vuelva la señal, toca Reintentar.</p>
      <a href="" className={`${botonPrimario} mt-3`}>
        Reintentar
      </a>
    </main>
  );
}
