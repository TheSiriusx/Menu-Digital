import { BotonCopiar, BotonImprimir } from "@/components/admin/qr-acciones";
import { generarQR, urlDelMenu } from "@/lib/qr";

// Pantalla del QR del menú. La usan el dueño (/admin/qr) y el super admin (por local).
export async function VistaQR({ nombre, slug }: { nombre: string; slug: string }) {
  const url = await urlDelMenu(slug);
  const qr = await generarQR(url);

  return (
    <main className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-lg font-semibold">QR del menú</h2>
        <p className="text-sm text-muted">
          Imprímelo y pégalo en el local: el cliente lo escanea con la cámara y ve tu menú.
        </p>
      </div>

      <section
        aria-label="Tarjeta imprimible"
        className="mx-auto flex max-w-xs flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-6 text-center text-neutral-900 print:border-0"
      >
        <p className="text-xl font-semibold leading-tight">{nombre}</p>
        <p className="text-sm text-neutral-600">Escanea para ver el menú</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr.svg} alt={`Código QR del menú de ${nombre}`} width={240} height={240} className="h-60 w-60" />
        <p className="break-all text-xs text-neutral-500">{url}</p>
      </section>

      <div className="flex flex-wrap justify-center gap-2 print:hidden">
        <BotonCopiar texto={url} />
        <BotonImprimir />
        <a href={qr.svg} download={`qr-${slug}.svg`} className="rounded-full border border-line px-4 py-2 text-sm font-medium">
          Descargar SVG
        </a>
        <a href={qr.png} download={`qr-${slug}.png`} className="rounded-full border border-line px-4 py-2 text-sm font-medium">
          Descargar PNG
        </a>
      </div>

      <p className="text-center text-xs text-muted print:hidden">
        Este QR apunta a <strong>{url}</strong>. Si algún día el enlace cambia (por ejemplo, al pasar a un dominio
        propio), el papel ya impreso seguirá apuntando al anterior.
      </p>
    </main>
  );
}
