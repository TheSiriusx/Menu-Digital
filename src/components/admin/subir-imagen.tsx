"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import type { Estado } from "@/lib/validacion";

// Recorte cuadrado centrado + reducción + WebP. Al volver a dibujar la imagen en un canvas
// se pierden los metadatos EXIF (dónde se tomó la foto, el modelo del celular, etc.), y la
// foto pasa de varios MB a unos 30 KB.
async function reducir(archivo: File, lado: number): Promise<Blob> {
  // "from-image" respeta la orientación con que el celular guardó la foto.
  const imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  const origen = Math.min(imagen.width, imagen.height);
  const destino = Math.min(lado, origen);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = destino;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("sin canvas");
  ctx.drawImage(imagen, (imagen.width - origen) / 2, (imagen.height - origen) / 2, origen, origen, 0, 0, destino, destino);
  imagen.close();

  const aBlob = (tipo: string) => new Promise<Blob | null>((res) => canvas.toBlob(res, tipo, 0.82));
  const webp = await aBlob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await aBlob("image/jpeg"); // navegadores sin soporte de WebP
  if (!jpeg) throw new Error("no se pudo codificar");
  return jpeg;
}

export function SubirImagen({
  accion,
  campos,
  lado,
  texto,
  children,
}: {
  accion: (datos: FormData) => Promise<Estado>;
  campos: Record<string, string>;
  lado: number;
  texto: string;
  // Con `children`, eso mismo (p. ej. la miniatura del producto) es lo que se toca para elegir la imagen;
  // `texto` queda como nombre accesible y el error se muestra flotando debajo, sin mover la fila.
  children?: ReactNode;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [mensaje, setMensaje] = useState<Estado>({});
  const [ocupado, empezar] = useTransition();

  async function alElegir(archivo: File | undefined) {
    if (!archivo) return;
    setMensaje({});
    let blob: Blob;
    try {
      blob = await reducir(archivo, lado);
    } catch {
      setMensaje({ error: "No se pudo leer esa imagen. Prueba con otra (JPG o PNG)." });
      if (entrada.current) entrada.current.value = "";
      return;
    }
    const datos = new FormData();
    for (const [nombre, valor] of Object.entries(campos)) datos.append(nombre, valor);
    datos.append("archivo", new File([blob], "imagen", { type: blob.type }));

    empezar(async () => {
      setMensaje(await accion(datos));
      if (entrada.current) entrada.current.value = "";
    });
  }

  const entradaArchivo = (
    <input
      ref={entrada}
      type="file"
      accept="image/*"
      disabled={ocupado}
      aria-label={children ? texto : undefined}
      className="sr-only"
      onChange={(e) => alElegir(e.target.files?.[0])}
    />
  );

  if (children) {
    return (
      <div className="relative shrink-0">
        <label title={texto} className={`group/foto relative block cursor-pointer rounded-[9px] focus-within:ring-3 focus-within:ring-brand-text/30 ${ocupado ? "opacity-60" : ""}`}>
          {children}
          <span
            aria-hidden="true"
            className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface-200 text-ink-muted group-hover/foto:text-ink"
          >
            {ocupado ? (
              <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            )}
          </span>
          {entradaArchivo}
        </label>
        {mensaje.error && (
          <p role="alert" className="absolute top-full left-0 z-10 mt-1.5 w-60 rounded-lg border border-line bg-surface-200 px-3 py-2 text-xs text-danger">
            {mensaje.error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <label
        className={`inline-block cursor-pointer rounded-[10px] border border-line bg-surface-200 px-4 py-2 text-[13px] font-semibold hover:bg-surface-100 ${
          ocupado ? "opacity-50" : ""
        }`}
      >
        {ocupado ? "Subiendo…" : texto}
        {entradaArchivo}
      </label>
      {mensaje.error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {mensaje.error}
        </p>
      )}
      {mensaje.ok && (
        <p role="status" className="mt-2 text-sm text-brand-text">
          {mensaje.ok}
        </p>
      )}
    </div>
  );
}
