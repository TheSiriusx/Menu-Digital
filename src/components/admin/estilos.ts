// Constantes de estilo compartidas. Viven aquí y NO en ui.tsx: ese archivo es "use client", y un
// componente de servidor que importa una constante desde un archivo cliente no recibe el valor
// sino una referencia que lanza error (el resultado era una clase CSS con texto de error).
export const estiloCampo =
  "w-full rounded-xl border border-field bg-surface px-3.5 py-2.5 text-base outline-offset-0 focus-visible:outline-2";
