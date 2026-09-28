// Interruptor (switch) con su etiqueta al lado. Va dentro de un <form>: al pulsarlo se envía.
export function Interruptor({ encendido, si, no, etiqueta }: { encendido: boolean; si: string; no: string; etiqueta?: string }) {
  return (
    <button type="submit" aria-pressed={encendido} aria-label={etiqueta} className="flex items-center gap-2 rounded-full py-1">
      <span
        aria-hidden="true"
        className={`flex h-6 w-[42px] shrink-0 items-center rounded-full p-[3px] transition-colors ${encendido ? "justify-end bg-exito" : "justify-start bg-[#d8d2c4]"}`}
      >
        <span className="block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]" />
      </span>
      <span className={`text-xs font-semibold ${encendido ? "text-exito" : "text-muted"}`}>{encendido ? si : no}</span>
    </button>
  );
}
