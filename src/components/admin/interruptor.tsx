// Interruptor (switch) con su etiqueta al lado. Va dentro de un <form>: al pulsarlo se envía.
export function Interruptor({ encendido, si, no, etiqueta }: { encendido: boolean; si: string; no: string; etiqueta?: string }) {
  return (
    <button type="submit" aria-pressed={encendido} aria-label={etiqueta} className="flex items-center gap-2 rounded-full py-1">
      <span
        aria-hidden="true"
        className={`flex h-6 w-[42px] shrink-0 items-center rounded-full p-[3px] transition-colors ${encendido ? "justify-end bg-brand" : "justify-start bg-ink-muted/35"}`}
      >
        <span className={`block h-[18px] w-[18px] rounded-full ${encendido ? "bg-accent" : "bg-surface-100"}`} />
      </span>
      <span className={`text-xs font-semibold ${encendido ? "text-brand-text" : "text-ink-muted"}`}>{encendido ? si : no}</span>
    </button>
  );
}
