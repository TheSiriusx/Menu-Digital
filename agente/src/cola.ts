// Junta los mensajes seguidos de un mismo cliente («hola» · «quiero pan» · «para las 5») y los atiende juntos,
// de a un lote por cliente a la vez (nunca dos respuestas cruzadas para la misma persona).
export class Cola<T> {
  private pendientes = new Map<string, { items: T[]; temporizador: ReturnType<typeof setTimeout> }>();
  private cadenas = new Map<string, Promise<void>>();
  private esperaMs: number;
  private procesar: (clave: string, items: T[]) => Promise<void>;

  constructor(esperaMs: number, procesar: (clave: string, items: T[]) => Promise<void>) {
    this.esperaMs = esperaMs;
    this.procesar = procesar;
  }

  agregar(clave: string, item: T) {
    const p = this.pendientes.get(clave);
    if (p) clearTimeout(p.temporizador);
    const items = [...(p?.items ?? []), item];
    const temporizador = setTimeout(() => this.soltar(clave), this.esperaMs);
    this.pendientes.set(clave, { items, temporizador });
  }

  private soltar(clave: string) {
    const p = this.pendientes.get(clave);
    if (!p) return;
    this.pendientes.delete(clave);
    const anterior = this.cadenas.get(clave) ?? Promise.resolve();
    const siguiente = anterior.then(() => this.procesar(clave, p.items)).catch(() => {});
    this.cadenas.set(clave, siguiente);
    void siguiente.finally(() => {
      if (this.cadenas.get(clave) === siguiente) this.cadenas.delete(clave);
    });
  }

  // Atiende ya todo lo pendiente y espera a que termine (pruebas y apagado ordenado).
  async vaciar() {
    for (const [clave, p] of [...this.pendientes]) {
      clearTimeout(p.temporizador);
      this.soltar(clave);
    }
    await Promise.all([...this.cadenas.values()]);
  }

  get enEspera() {
    return this.pendientes.size + this.cadenas.size;
  }
}
