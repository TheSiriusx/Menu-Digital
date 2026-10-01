import Link from "next/link";
import { EMPRESA, MARCA } from "@/lib/marca";

// Portada: la plataforma no tiene una lista pública de locales (cada menú se comparte por su enlace o su QR).
export default function Inicio() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <h1 className="text-4xl tracking-tight">{MARCA}</h1>
      <p className="max-w-md text-muted">
        Pedidos por WhatsApp desde el menú de tu negocio. Si eres cliente de un local, abre el enlace o escanea el QR
        que te dieron.
      </p>
      <Link href="/login" className="rounded-[10px] bg-(--acento) px-5 py-2.5 text-[13px] font-semibold text-(--sobre-acento)">
        Entrar al panel
      </Link>
      <p className="mt-6 text-xs text-muted">{MARCA} by {EMPRESA}</p>
    </main>
  );
}
