export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Menú no encontrado</h1>
      <p className="max-w-sm text-zinc-600 dark:text-zinc-400">
        Revisa que el enlace esté bien escrito o pídele al local su enlace actualizado.
      </p>
    </main>
  );
}
