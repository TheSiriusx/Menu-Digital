"use client";

import { PantallaError } from "@/components/pantalla-error";

// Dentro del marco del panel: la barra lateral sigue en pie y «Reintentar» vuelve a cargar solo el contenido.
export default function ErrorSuperadmin({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <PantallaError retry={retry} />;
}
