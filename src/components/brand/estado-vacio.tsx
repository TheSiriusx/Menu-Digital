import { IsotipoApoyo } from "@/components/brand/Logo";

// Estado vacío o mensaje amable: isotipo de apoyo (Bolsa para pedidos y ventas, Sonrisa para lo demás) y una línea
// de texto en ink-muted.
export function EstadoVacio({ forma = "bolsa", texto, className = "" }: { forma?: "bolsa" | "sonrisa"; texto: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-1 py-6 text-center ${className}`}>
      <IsotipoApoyo forma={forma} width={44} />
      <p className="text-sm text-ink-muted">{texto}</p>
    </div>
  );
}
