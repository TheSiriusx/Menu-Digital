"use client";

import { useSyncExternalStore } from "react";

// En la app instalada, el enlace del correo de recuperación se abre en el navegador (Safari o Chrome), que no comparte
// nada con la app; y el enlace solo sirve en el navegador donde se pidió. Por eso, dentro de la app, se pide hacer la
// recuperación desde el navegador.
const instalada = () => {
  const nav = navigator as Navigator & { standalone?: boolean };
  return matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
};

export function AvisoRecuperarEnNavegador() {
  const enApp = useSyncExternalStore(() => () => {}, instalada, () => false);
  if (!enApp) return null;
  return (
    <p role="note" className="mb-4 rounded-brand-sm bg-accent px-3.5 py-3 text-[13px] text-deep">
      Estás en la app. El enlace del correo se abre en el navegador y solo funciona donde lo pediste: abre esta página en Safari o Chrome,
      crea ahí tu nueva contraseña y luego vuelve a la app para entrar con ella.
    </p>
  );
}
