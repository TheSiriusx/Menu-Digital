"""Foto de los datos REALES de Nueva Victoria antes de probar, para devolverlos tal cual al terminar.
Guarda el local, su configuración del asistente, categorías, productos, clientes, pedidos (con sus items y avisos)
y la lista de archivos de Storage. Así las pruebas nunca pisan lo que el dueño cambió (teléfono, precios, logo…)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import sql

S = os.path.dirname(os.path.abspath(__file__))
ARCHIVO = os.path.join(S, "foto-real.json")
SLUG = "nueva-victoria"
TABLAS = ["categorias", "productos", "clientes", "pedidos", "pedido_items", "agente_avisos"]


def sesion_en_curso():
    return os.path.exists(os.path.join(S, "e2e4.env"))


def tomar():
    """Toma la foto salvo que ya haya una de esta misma sesión de pruebas."""
    if os.path.exists(ARCHIVO) and sesion_en_curso():
        return
    partes = ",".join(f"'{t}', (select coalesce(json_agg(x), '[]') from public.{t} x where x.negocio_id = n.id)" for t in TABLAS)
    foto = sql(f"""select json_build_object(
        'negocio', to_json(n),
        'config', (select to_json(c) from public.agente_config c where c.negocio_id = n.id),
        'storage', (select coalesce(json_agg(o.name), '[]') from storage.objects o where o.bucket_id = 'menu-media'),
        {partes}) as f
      from public.negocios n where n.slug = '{SLUG}'""")[0]["f"]
    fd = os.open(ARCHIVO, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with open(fd, "w", encoding="utf-8") as f:
        json.dump(foto, f, ensure_ascii=False)


def leer():
    return json.load(open(ARCHIVO, encoding="utf-8")) if os.path.exists(ARCHIVO) else None


def restaurar(foto):
    lit = lambda v: "$foto$" + json.dumps(v, ensure_ascii=False) + "$foto$"
    n = foto["negocio"]
    nid = n["id"]
    cols = "nombre, tipo, logo_url, color, telefono_whatsapp, horario, tasa_bs, activo, plan, evolution_instance_name"
    sql(f"""
    begin;
    delete from public.pedidos    where negocio_id = '{nid}';   -- (items y avisos se van con ellos)
    delete from public.clientes   where negocio_id = '{nid}';
    delete from public.productos  where negocio_id = '{nid}';
    delete from public.categorias where negocio_id = '{nid}';
    update public.negocios set ({cols}) = (select {cols} from json_populate_record(null::public.negocios, {lit(n)}::json)) where id = '{nid}';
    delete from public.agente_config where negocio_id = '{nid}';
    insert into public.agente_config select * from json_populate_record(null::public.agente_config, {lit(foto["config"])}::json);
    insert into public.categorias   select * from json_populate_recordset(null::public.categorias,   {lit(foto["categorias"])}::json);
    insert into public.productos    select * from json_populate_recordset(null::public.productos,    {lit(foto["productos"])}::json);
    insert into public.clientes     select * from json_populate_recordset(null::public.clientes,     {lit(foto["clientes"])}::json);
    insert into public.pedidos      select * from json_populate_recordset(null::public.pedidos,      {lit(foto["pedidos"])}::json);
    insert into public.pedido_items select * from json_populate_recordset(null::public.pedido_items, {lit(foto["pedido_items"])}::json);
    -- Reinsertar pedidos dispara el trigger de avisos: se descartan y vuelven los que había.
    delete from public.agente_avisos where negocio_id = '{nid}';
    insert into public.agente_avisos overriding system value
      select * from json_populate_recordset(null::public.agente_avisos, {lit(foto["agente_avisos"])}::json);
    commit;""")


def iguales(foto):
    ahora = sql(f"""select json_build_object('negocio', to_json(n),
        'config', (select to_json(c) from public.agente_config c where c.negocio_id = n.id),
        {",".join(f"'{t}', (select coalesce(json_agg(x order by x.id), '[]') from public.{t} x where x.negocio_id = n.id)" for t in TABLAS)}) as f
      from public.negocios n where n.slug = '{SLUG}'""")[0]["f"]
    orden = lambda filas: sorted(filas or [], key=lambda r: str(r.get("id")))
    sin_fechas = lambda d: {k: v for k, v in (d or {}).items() if k != "actualizado_en"}
    return (ahora["negocio"] == foto["negocio"] and sin_fechas(ahora["config"]) == sin_fechas(foto["config"])
            and all(orden(ahora[t]) == orden(foto[t]) for t in TABLAS))
