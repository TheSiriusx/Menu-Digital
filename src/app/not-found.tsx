export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <p className="text-5xl font-semibold tracking-tight text-muted">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Menú no encontrado</h1>
      <p className="max-w-xs text-muted">
        Revisa que el enlace esté bien escrito o pídele al local su enlace actualizado.
      </p>
    </main>
  );
}
