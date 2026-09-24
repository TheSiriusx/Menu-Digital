"use client";

export default function ErrorSuperadmin({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="py-12 text-center">
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">No se pudo completar la acción. Inténtalo de nuevo.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
      >
        Reintentar
      </button>
    </main>
  );
}
