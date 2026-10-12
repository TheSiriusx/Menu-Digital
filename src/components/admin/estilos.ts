// Constantes de estilo compartidas. Viven aquí y NO en ui.tsx: ese archivo es "use client", y un
// componente de servidor que importa una constante desde un archivo cliente no recibe el valor
// sino una referencia que lanza error (el resultado era una clase CSS con texto de error).
export const estiloCampo =
  "w-full rounded-[10px] border border-line bg-surface-100 px-3.5 py-2.5 text-[15px] text-ink outline-offset-0 focus-visible:border-brand focus-visible:bg-surface-200 focus-visible:outline-2";

// Botón primario de Pidelo para enlaces y botones que no son <Boton>: brand con texto accent, forma de marca y al
// menos 44 px de alto. Sobre fondos azules o deep se usa el inverso (botonPrimarioInverso).
export const botonPrimario =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-brand-sm bg-brand px-5 py-2.5 text-[14.5px] font-bold text-accent hover:bg-deep disabled:opacity-60";
export const botonPrimarioInverso =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-brand-sm bg-accent px-5 py-2.5 text-[14.5px] font-bold text-deep disabled:opacity-60";
