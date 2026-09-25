"use client";

import { useRef, useState, useTransition } from "react";
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
}: {
  accion: (datos: FormData) => Promise<Estado>;
  campos: Record<string, string>;
  lado: number;
  texto: string;
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

  return (
    <div>
      <label
        className={`inline-block cursor-pointer rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700 ${
          ocupado ? "opacity-50" : ""
        }`}
      >
        {ocupado ? "Subiendo…" : texto}
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          disabled={ocupado}
          className="sr-only"
          onChange={(e) => alElegir(e.target.files?.[0])}
        />
      </label>
      {mensaje.error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {mensaje.error}
        </p>
      )}
      {mensaje.ok && (
        <p role="status" className="mt-2 text-sm text-green-700 dark:text-green-400">
          {mensaje.ok}
        </p>
      )}
    </div>
  );
}
