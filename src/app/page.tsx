import Link from "next/link";

// Portada: la plataforma no tiene una lista pública de locales (cada menú se comparte por su enlace o su QR).
export default function Inicio() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Starck Labs — Menús digitales</h1>
      <p className="max-w-md text-muted">
        Menús con pedidos por WhatsApp para panaderías y locales. Si eres cliente de un local, abre el enlace o escanea
        el QR que te dieron.
      </p>
      <Link href="/login" className="rounded-[10px] bg-(--acento) px-5 py-2.5 text-[13px] font-semibold text-(--sobre-acento)">
        Entrar al panel
      </Link>
    </main>
  );
}
