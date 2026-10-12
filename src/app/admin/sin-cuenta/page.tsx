import { IsotipoApoyo } from "@/components/brand/Logo";

export default function SinCuenta() {
  return (
    <main className="flex flex-col items-center py-12 text-center">
      <IsotipoApoyo forma="sonrisa" width={56} />
      <h1 className="text-title">Tu cuenta todavía no está vinculada a un local</h1>
      <p className="mx-auto mt-2 max-w-sm text-ink-muted">
        Escríbele a Starck Labs para que la activen. Mientras tanto puedes cerrar sesión con el botón de arriba.
      </p>
    </main>
  );
}
