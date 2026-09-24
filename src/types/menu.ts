// Tipos del modelo público (solo las columnas que la clave anon puede leer; ver 0002_rls.sql).

export type Negocio = {
  id: string;
  slug: string;
  nombre: string;
  tipo: string;
  logo_url: string | null;
  color: string | null;
  telefono_whatsapp: string | null;
  horario: string | null;
  tasa_bs: number;
  activo: boolean;
};

export type Producto = {
  id: string;
  categoria_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio_usd: number;
  disponible: boolean;
  foto_url: string | null;
  orden: number;
};

export type Categoria = {
  id: string;
  nombre: string;
  orden: number;
};

export type CategoriaConProductos = Categoria & { productos: Producto[] };

export type Menu = {
  negocio: Negocio;
  categorias: CategoriaConProductos[];
  // Productos cuya categoría fue eliminada: se muestran al final, sin título.
  sinCategoria: Producto[];
};
