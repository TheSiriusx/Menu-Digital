// Tipos mínimos de node:sqlite (incluido en Node 24; los @types/node del proyecto web son anteriores).
declare module "node:sqlite" {
  type Valor = null | number | bigint | string | Uint8Array;
  export class StatementSync {
    run(...parametros: Valor[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...parametros: Valor[]): Record<string, unknown> | undefined;
    all(...parametros: Valor[]): Record<string, unknown>[];
  }
  export class DatabaseSync {
    constructor(ruta: string, opciones?: Record<string, unknown>);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
