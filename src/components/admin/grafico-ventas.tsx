import { etiquetaPeriodo, type Grano } from "@/lib/fechas";
import { formatUsd } from "@/lib/precios";
import type { VentaPeriodo } from "@/types/panel";

const UNIDAD: Record<Grano, string> = { day: "día", week: "semana", month: "mes" };

// Gráfico de barras propio (SVG, sin librerías). Cada barra es un SVG que se estira a su columna; las
// etiquetas son texto normal debajo, así se leen bien en cualquier ancho. Para lectores de pantalla y
// para quien no distingue barras hay una tabla equivalente.
export function GraficoVentas({ serie, grano, anioActual }: { serie: VentaPeriodo[]; grano: Grano; anioActual: string }) {
  const maximo = Math.max(...serie.map((f) => f.total_usd), 0);
  const cadaCuanto = serie.length > 16 ? 4 : serie.length > 8 ? 2 : 1;
  const total = serie.reduce((t, f) => t + f.total_usd, 0);

  return (
    <figure>
      <div role="img" aria-label={`Ventas por ${UNIDAD[grano]}: total ${formatUsd(total)} en ${serie.length} periodos.`}>
        <div className="flex h-44 items-end gap-0.5 sm:gap-1" data-grafico={grano}>
          {serie.map((f) => {
            const alto = maximo > 0 ? Math.max((f.total_usd / maximo) * 100, f.total_usd > 0 ? 3 : 0) : 0;
            return (
              <svg key={f.periodo} viewBox="0 0 10 100" preserveAspectRatio="none" className="h-full min-w-0 flex-1" aria-hidden="true">
                <title>{`${etiquetaPeriodo(f.periodo, grano, anioActual)}: ${formatUsd(f.total_usd)} (${f.pedidos} pedidos)`}</title>
                <rect x="0" y="99" width="10" height="1" className="fill-line" />
                {alto > 0 && <rect x="0" y={100 - alto} width="10" height={alto} rx="1" className="fill-foreground" />}
              </svg>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-0.5 text-[11px] text-muted sm:gap-1" aria-hidden="true">
          {serie.map((f, i) => (
            <span key={f.periodo} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
              {i % cadaCuanto === 0 ? etiquetaPeriodo(f.periodo, grano, anioActual) : ""}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">Tabla equivalente del gráfico</figcaption>
      <table className="sr-only">
        <thead>
          <tr><th>Periodo</th><th>Pedidos</th><th>Ventas en dólares</th></tr>
        </thead>
        <tbody>
          {serie.map((f) => (
            <tr key={f.periodo}>
              <td>{etiquetaPeriodo(f.periodo, grano, anioActual)}</td>
              <td>{f.pedidos}</td>
              <td>{formatUsd(f.total_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
