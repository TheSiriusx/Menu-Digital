"use client";

import { PantallaError } from "@/components/pantalla-error";

// Errores en las páginas fuera del panel (login, verificación, menú público). El panel y el super admin tienen el suyo.
export default function ErrorSitio({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <PantallaError retry={retry} />;
}
