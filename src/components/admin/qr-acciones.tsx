"use client";

import { useState } from "react";

const boton = "rounded-full border border-line px-4 py-2 text-sm font-medium";

export function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // sin permiso de portapapeles: el enlace sigue visible para copiarlo a mano
    }
  }

  return (
    <button type="button" onClick={copiar} className={boton}>
      {copiado ? "¡Copiado!" : "Copiar enlace"}
    </button>
  );
}

export function BotonImprimir() {
  return (
    <button type="button" onClick={() => window.print()} className={boton}>
      Imprimir
    </button>
  );
}
