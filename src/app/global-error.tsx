"use client";

import { PantallaError } from "@/components/pantalla-error";
import { MARCA } from "@/lib/marca";
import { clasesFuentes } from "./fuentes";
import "./globals.css";

// Último recurso: un error en el layout raíz. Reemplaza al documento entero, así que trae su <html>, estilos y fuentes.
export default function ErrorGlobal({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="es" className={`${clasesFuentes} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <title>{`No se pudo completar | ${MARCA}`}</title>
        <PantallaError retry={retry} />
      </body>
    </html>
  );
}
