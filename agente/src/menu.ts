// Menú real del local (Supabase), con una caché corta, y búsqueda de productos por lo que escribe el cliente.
import type { ProductoMenu } from "./tipos.ts";
import { normalizar } from "./texto.ts";

type FuenteMenu = { menu(instancia: string): Promise<ProductoMenu[]> };

export class Menus {
  private cache = new Map<string, { hasta: number; menu: ProductoMenu[] }>();
  private fuente: FuenteMenu;
  private ahora: () => Date;
  private ttlMs: number;
  constructor(fuente: FuenteMenu, ahora: () => Date = () => new Date(), ttlMs = 30_000) {
    this.fuente = fuente;
    this.ahora = ahora;
    this.ttlMs = ttlMs;
  }

  async de(instancia: string): Promise<ProductoMenu[]> {
    const c = this.cache.get(instancia);
    if (c && c.hasta > this.ahora().getTime()) return c.menu;
    const menu = await this.fuente.menu(instancia);
    this.cache.set(instancia, { hasta: this.ahora().getTime() + this.ttlMs, menu });
    return menu;
  }

  // Después de vender, el stock cambió: la próxima consulta va a la base.
  invalidar(instancia: string) {
    this.cache.delete(instancia);
  }
}

const singular = (p: string) => (p.length > 3 && p.endsWith("es") ? p.slice(0, -2) : p.length > 3 && p.endsWith("s") ? p.slice(0, -1) : p);
const palabras = (s: string) => normalizar(s).split(" ").filter((p) => p.length > 1 && !["de", "del", "la", "el", "los", "las", "con", "un", "una"].includes(p)).map(singular);

export type Resolucion = { ok: true; producto: ProductoMenu } | { ok: false; motivo: "no_encontrado" | "ambiguo"; opciones: string[] };

// Encuentra el producto al que se refiere el cliente («canillas», «pan de jamón», «tequeños»...).
export function resolverProducto(menu: ProductoMenu[], texto: string): Resolucion {
  const q = normalizar(texto);
  if (!q) return { ok: false, motivo: "no_encontrado", opciones: [] };
  const porCodigo = menu.find((p) => p.codigo === q);
  if (porCodigo) return { ok: true, producto: porCodigo };
  const exacto = menu.filter((p) => normalizar(p.nombre) === q);
  if (exacto.length === 1) return { ok: true, producto: exacto[0] };

  const qp = palabras(q);
  const puntaje = (p: ProductoMenu) => {
    const np = palabras(p.nombre);
    const comunes = qp.filter((w) => np.some((n) => n === w || (w.length > 3 && (n.startsWith(w) || w.startsWith(n))))).length;
    if (!comunes) return 0;
    // Todas las palabras del cliente están en el nombre, y el nombre no tiene muchas palabras de más.
    return comunes / qp.length + comunes / np.length;
  };
  const conPuntaje = menu.map((p) => ({ p, s: puntaje(p) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!conPuntaje.length) return { ok: false, motivo: "no_encontrado", opciones: [] };
  const mejor = conPuntaje[0];
  const empatados = conPuntaje.filter((x) => Math.abs(x.s - mejor.s) < 1e-9);
  if (empatados.length > 1) return { ok: false, motivo: "ambiguo", opciones: empatados.slice(0, 5).map((x) => x.p.nombre) };
  if (mejor.s < 1) return { ok: false, motivo: "ambiguo", opciones: conPuntaje.slice(0, 5).map((x) => x.p.nombre) };
  return { ok: true, producto: mejor.p };
}
