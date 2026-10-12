import { IsotipoApoyo } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <IsotipoApoyo forma="sonrisa" width={72} />
      <p className="font-display text-display text-brand-text">404</p>
      <h1 className="text-title text-ink">Menú no encontrado</h1>
      <p className="max-w-xs text-ink-muted">Revisa que el enlace esté bien escrito o pídele al local su enlace actualizado.</p>
    </main>
  );
}
