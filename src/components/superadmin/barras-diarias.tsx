import { fechaCorta } from "@/lib/fechas";

// Barras por día (servidor, sin JavaScript). Cada barra lleva su valor en el título (al pasar el cursor) y
// para lectores de pantalla va también una tabla oculta con los datos.
export function BarrasDiarias({ titulo, serie, formato = (n: number) => String(n), tono = "acento" }: {
  titulo: string;
  serie: { dia: string; valor: number }[];
  formato?: (n: number) => string;
  tono?: "acento" | "exito";
}) {
  const max = Math.max(1, ...serie.map((s) => s.valor));
  const total = serie.reduce((s, x) => s + x.valor, 0);
  const anio = serie.at(-1)?.dia.slice(0, 4);
  const marcas = serie.length > 1 ? [serie[0], serie[Math.floor((serie.length - 1) / 2)], serie[serie.length - 1]] : serie;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{titulo}</span>
        <span className="text-xs text-muted">Total: {formato(total)}</span>
      </figcaption>
      <div aria-hidden="true" className="flex h-36 items-end gap-[2px] border-b border-line">
        {serie.map((s) => (
          <div
            key={s.dia}
            title={`${fechaCorta(s.dia, anio)}: ${formato(s.valor)}`}
            style={{ height: `${s.valor > 0 ? Math.max(4, (s.valor / max) * 100) : 0}%` }}
            className={`min-w-0 flex-1 rounded-t-[3px] ${tono === "exito" ? "bg-exito/80 hover:bg-exito" : "bg-(--acento)/80 hover:bg-(--acento)"}`}
          />
        ))}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex justify-between text-[11px] text-muted">
        {marcas.map((m) => <span key={m.dia}>{fechaCorta(m.dia, anio)}</span>)}
      </div>
      <div className="sr-only">
        <table>
          <caption>{titulo}</caption>
          <tbody>{serie.map((s) => <tr key={s.dia}><th scope="row">{s.dia}</th><td>{formato(s.valor)}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}
