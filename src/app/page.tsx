import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { botonPrimario } from "@/components/admin/estilos";
import { ESLOGAN, FIRMA } from "@/lib/marca";

// Portada: la plataforma no tiene una lista pública de locales (cada menú se comparte por su enlace o su QR).
// Es también la página a la que lleva el «Hecho con Pidelo» del pie de cada menú.
export default function Inicio() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Logo variant="isologo" width={112} />
      <h1 className="max-w-xl text-display-xl text-ink">{ESLOGAN}</h1>
      <p className="max-w-md text-body-lg text-ink-muted">
        Pedidos por WhatsApp desde el menú de tu negocio. Si eres cliente de un local, abre el enlace o escanea el QR que te
        dieron.
      </p>
      <Link href="/login" className={botonPrimario}>
        Entrar al panel
      </Link>
      <p className="mt-6 text-caption text-ink-muted">{FIRMA}</p>
    </main>
  );
}
