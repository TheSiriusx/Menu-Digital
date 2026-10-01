"use client";

// Pantalla cuando algo falla; casi siempre es una conexión que se cortó a mitad de una acción (señal mala).
// Sustituye a la de Next, que sale en inglés y trae un <style> en línea que la CSP bloquea.
// «Reintentar» vuelve a pedir la página al servidor y la pinta de nuevo.
export function PantallaError({ retry }: { retry: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="text-2xl leading-tight">No se pudo completar</h1>
      <p className="max-w-sm text-[14.5px] text-muted">
        Puede que se haya cortado la conexión. Revisa tu internet y vuelve a intentarlo.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-3 rounded-[10px] bg-(--acento) px-5 py-2.5 text-[13px] font-semibold text-(--sobre-acento)"
      >
        Reintentar
      </button>
    </main>
  );
}
