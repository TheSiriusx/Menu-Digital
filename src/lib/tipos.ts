// Tipos de negocio y planes. `tipo` es texto libre en la base de datos (agregar un nicho no
// exige migración); esta lista es la que ofrece el super admin.
export const TIPOS = [
  { valor: "panaderia", etiqueta: "Panadería" },
  { valor: "restaurante", etiqueta: "Restaurante" },
  { valor: "puesto-de-comida", etiqueta: "Puesto de comida" },
  { valor: "charcuteria", etiqueta: "Charcutería" },
  { valor: "fruteria", etiqueta: "Frutería" },
  { valor: "licoreria", etiqueta: "Licorería" },
  { valor: "otro", etiqueta: "Otro" },
] as const;

export const PLANES = [
  { valor: "basico", etiqueta: "Básico" },
  { valor: "pro", etiqueta: "Pro" },
] as const;

export const etiquetaTipo = (valor: string) => TIPOS.find((t) => t.valor === valor)?.etiqueta ?? valor;
export const etiquetaPlan = (valor: string) => PLANES.find((p) => p.valor === valor)?.etiqueta ?? valor;
