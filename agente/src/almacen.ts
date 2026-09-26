// Datos propios del agente (conversaciones, contactos, pausas, borradores de pedido), en SQLite.
// Lo del negocio (menú, pedidos, clientes) vive en Supabase: aquí solo lo que hace falta para conversar.
import { DatabaseSync } from "node:sqlite";
import type { Contacto, Rol } from "./tipos.ts";

const ESQUEMA = `
create table if not exists contactos (
  id integer primary key,
  instancia text not null,
  telefono text,
  lid text,
  nombre text,
  creado text not null,
  actualizado text not null
);
create unique index if not exists contactos_tel on contactos (instancia, telefono) where telefono is not null;
create unique index if not exists contactos_lid on contactos (instancia, lid) where lid is not null;

create table if not exists mensajes (
  id integer primary key,
  contacto_id integer not null references contactos (id) on delete cascade,
  rol text not null check (rol in ('cliente', 'asistente', 'equipo')),
  contenido text not null,
  tipo text not null default 'texto',
  creado text not null
);
create index if not exists mensajes_contacto on mensajes (contacto_id, id);

-- Mensajes ya atendidos (Evolution puede repetir un webhook) y mensajes que envió el propio agente
-- (vuelven como «fromMe»: no hay que confundirlos con el dueño escribiendo a mano).
create table if not exists procesados (message_id text primary key, creado text not null);
create table if not exists enviados (message_id text primary key, creado text not null);

create table if not exists pausas (contacto_id integer primary key, hasta text not null, motivo text not null);

-- Pedido armado por conversación, esperando el «sí» del cliente.
create table if not exists borradores (contacto_id integer primary key, datos text not null, creado text not null);

create table if not exists encargos (id integer primary key, contacto_id integer not null, datos text not null, creado text not null);

-- El número del WhatsApp de cada local (lo manda Evolution en cada mensaje): a él van los avisos al dueño.
create table if not exists instancias (instancia text primary key, numero_propio text not null, actualizado text not null);
`;

export type Borrador = {
  items: { codigo: string; nombre: string; cantidad: number; precio_usd: number }[];
  entrega: "retiro" | "domicilio";
  direccion: string | null;
  notas: string | null;
  nombre: string | null;
  total_usd: number;
};

export class Almacen {
  readonly db: DatabaseSync;
  private ahora: () => Date;

  constructor(ruta = ":memory:", ahora: () => Date = () => new Date()) {
    this.db = new DatabaseSync(ruta);
    this.ahora = ahora;
    this.db.exec("pragma journal_mode = wal; pragma foreign_keys = on;");
    this.db.exec(ESQUEMA);
  }

  private iso() {
    return this.ahora().toISOString();
  }

  // true si el mensaje ya se había atendido (y lo marca si no).
  yaProcesado(messageId: string): boolean {
    const r = this.db.prepare("insert or ignore into procesados (message_id, creado) values (?, ?)").run(messageId, this.iso());
    return r.changes === 0;
  }

  marcarEnviado(messageId: string | null) {
    if (messageId) this.db.prepare("insert or ignore into enviados (message_id, creado) values (?, ?)").run(messageId, this.iso());
  }

  fueEnviado(messageId: string): boolean {
    return !!this.db.prepare("select 1 from enviados where message_id = ?").get(messageId);
  }

  // Encuentra o crea el contacto por número o por LID, y aprende la relación entre ambos.
  contacto(instancia: string, telefono: string | null, lid: string | null, nombre: string | null, jid: string): Contacto {
    const ahora = this.iso();
    const porTel = telefono
      ? (this.db.prepare("select * from contactos where instancia = ? and telefono = ?").get(instancia, telefono) as Fila | undefined)
      : undefined;
    const porLid = lid
      ? (this.db.prepare("select * from contactos where instancia = ? and lid = ?").get(instancia, lid) as Fila | undefined)
      : undefined;
    const nombreValido = nombre && /\p{L}/u.test(nombre) ? nombre.slice(0, 80) : null;

    let fila = porTel ?? porLid;
    if (porTel && porLid && porTel.id !== porLid.id) {
      // El mismo cliente quedó dos veces (primero solo con LID): se unen en el que tiene número.
      this.db.prepare("update mensajes set contacto_id = ? where contacto_id = ?").run(porTel.id, porLid.id);
      this.db.prepare("delete from contactos where id = ?").run(porLid.id);
      fila = porTel;
    }
    if (!fila) {
      const r = this.db
        .prepare("insert into contactos (instancia, telefono, lid, nombre, creado, actualizado) values (?, ?, ?, ?, ?, ?)")
        .run(instancia, telefono, lid, nombreValido, ahora, ahora);
      fila = { id: Number(r.lastInsertRowid), instancia, telefono, lid, nombre: nombreValido };
    } else {
      this.db
        .prepare("update contactos set telefono = coalesce(telefono, ?), lid = coalesce(?, lid), nombre = coalesce(?, nombre), actualizado = ? where id = ?")
        .run(telefono, lid, nombreValido, ahora, fila.id);
      fila = this.db.prepare("select * from contactos where id = ?").get(fila.id) as Fila;
    }
    return { id: fila.id, instancia, telefono: fila.telefono, lid: fila.lid, nombre: fila.nombre, jid };
  }

  guardarMensaje(contactoId: number, rol: Rol, contenido: string, tipo = "texto") {
    if (!contenido.trim()) return;
    this.db
      .prepare("insert into mensajes (contacto_id, rol, contenido, tipo, creado) values (?, ?, ?, ?, ?)")
      .run(contactoId, rol, contenido.slice(0, 4000), tipo, this.iso());
  }

  historial(contactoId: number, n = 12): { rol: Rol; contenido: string; tipo: string; creado: string }[] {
    const filas = this.db
      .prepare("select rol, contenido, tipo, creado from mensajes where contacto_id = ? order by id desc limit ?")
      .all(contactoId, n) as { rol: Rol; contenido: string; tipo: string; creado: string }[];
    return filas.reverse();
  }

  // Cuántos mensajes escribió el cliente en la última hora (para frenar abusos y gasto de IA).
  mensajesUltimaHora(contactoId: number): number {
    const desde = new Date(this.ahora().getTime() - 3600_000).toISOString();
    const r = this.db.prepare("select count(*) as n from mensajes where contacto_id = ? and rol = 'cliente' and creado > ?").get(contactoId, desde) as { n: number };
    return Number(r.n);
  }

  pausa(contactoId: number): { hasta: string; motivo: string } | null {
    const p = this.db.prepare("select hasta, motivo from pausas where contacto_id = ?").get(contactoId) as { hasta: string; motivo: string } | undefined;
    if (!p) return null;
    if (p.hasta <= this.iso()) {
      this.db.prepare("delete from pausas where contacto_id = ?").run(contactoId);
      return null;
    }
    return p;
  }

  pausar(contactoId: number, horas: number, motivo: string) {
    const hasta = new Date(this.ahora().getTime() + horas * 3600_000).toISOString();
    this.db
      .prepare("insert into pausas (contacto_id, hasta, motivo) values (?, ?, ?) on conflict (contacto_id) do update set hasta = excluded.hasta, motivo = excluded.motivo")
      .run(contactoId, hasta, motivo);
  }

  borrador(contactoId: number, vigenciaMin = 60): Borrador | null {
    const b = this.db.prepare("select datos, creado from borradores where contacto_id = ?").get(contactoId) as { datos: string; creado: string } | undefined;
    if (!b) return null;
    if (new Date(b.creado).getTime() + vigenciaMin * 60_000 < this.ahora().getTime()) {
      this.borrarBorrador(contactoId);
      return null;
    }
    return JSON.parse(b.datos) as Borrador;
  }

  guardarBorrador(contactoId: number, b: Borrador) {
    this.db
      .prepare("insert into borradores (contacto_id, datos, creado) values (?, ?, ?) on conflict (contacto_id) do update set datos = excluded.datos, creado = excluded.creado")
      .run(contactoId, JSON.stringify(b), this.iso());
  }

  borrarBorrador(contactoId: number) {
    this.db.prepare("delete from borradores where contacto_id = ?").run(contactoId);
  }

  guardarEncargo(contactoId: number, datos: unknown) {
    this.db.prepare("insert into encargos (contacto_id, datos, creado) values (?, ?, ?)").run(contactoId, JSON.stringify(datos), this.iso());
  }

  // ¿Mandó una foto en las últimas horas? (referencia de un encargo)
  fotoReciente(contactoId: number, horas = 6): boolean {
    const desde = new Date(this.ahora().getTime() - horas * 3600_000).toISOString();
    return !!this.db.prepare("select 1 from mensajes where contacto_id = ? and rol = 'cliente' and tipo = 'imagen' and creado > ?").get(contactoId, desde);
  }

  recordarNumeroPropio(instancia: string, numero: string | null) {
    if (!numero) return;
    this.db
      .prepare("insert into instancias (instancia, numero_propio, actualizado) values (?, ?, ?) on conflict (instancia) do update set numero_propio = excluded.numero_propio, actualizado = excluded.actualizado")
      .run(instancia, numero, this.iso());
  }

  numeroPropio(instancia: string): string | null {
    const r = this.db.prepare("select numero_propio from instancias where instancia = ?").get(instancia) as { numero_propio: string } | undefined;
    return r?.numero_propio ?? null;
  }

  contactoPorTelefono(instancia: string, telefono: string): Contacto | null {
    const f = this.db.prepare("select * from contactos where instancia = ? and telefono = ?").get(instancia, telefono) as Fila | undefined;
    return f ? { id: f.id, instancia, telefono: f.telefono, lid: f.lid, nombre: f.nombre, jid: `${telefono}@s.whatsapp.net` } : null;
  }

  // Limpieza de tablas que solo crecen (se llama una vez al día).
  podar(dias = 7) {
    const desde = new Date(this.ahora().getTime() - dias * 86400_000).toISOString();
    this.db.prepare("delete from procesados where creado < ?").run(desde);
    this.db.prepare("delete from enviados where creado < ?").run(desde);
  }
}

type Fila = { id: number; instancia: string; telefono: string | null; lid: string | null; nombre: string | null };
