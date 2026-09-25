"""Siembra pedidos y clientes de prueba en Nueva Victoria (los borra limpiar.py). Uso: python3 pruebas/sembrar_b.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import sql

NV = sql("select id from public.negocios where slug='nueva-victoria'")[0]["id"]
sql(f"delete from public.pedidos where negocio_id='{NV}'; delete from public.clientes where negocio_id='{NV}'; update public.negocios set tasa_bs = 50 where id='{NV}';")

def ts(dias, hora):  # instante de "hoy - dias" a esa hora, en hora de Venezuela
    return f"((((now() at time zone 'America/Caracas')::date - {dias}) + time '{hora}') at time zone 'America/Caracas')"

clientes = {"ana": ("584121110001", "Ana"), "beto": ("584121110002", "Beto"), "carla": ("584121110003", "Carla"), "zoe": ("584121110004", "Zoe")}
sql("insert into public.clientes (negocio_id, telefono, nombre) values " + ",".join(f"('{NV}','{t}','{n}')" for t, n in clientes.values()))

# (cliente, estado, días atrás, hora, [(producto, cantidad)], entrega, dirección, notas, tasa)
pedidos = [
  ("ana",   "entregado",  0, "10:00", [("Pan canilla", 2), ("Café marrón", 1)], "retiro", None, None, 50),
  ("ana",   "pagado",     1, "23:30", [("Torta de chocolate", 1), ("Cachito de jamón", 2)], "domicilio", "Calle 1, casa 2", "sin cebolla <b>x</b>", 50),
  ("beto",  "confirmado", 0, "00:10", [("Pan de jamón", 1)], "retiro", None, None, 50),
  ("beto",  "nuevo",      0, "09:00", [("Refresco", 3)], "retiro", None, None, 50),
  ("carla", "cancelado",  3, "15:00", [("Quesillo", 1)], "retiro", None, None, 50),
  ("ana",   "entregado",  8, "11:00", [("Croissant", 1), ("Pan canilla", 1)], "retiro", None, None, 50),
  ("beto",  "entregado", 40, "12:00", [("Tequeños x10", 1)], "retiro", None, None, 40),
] + [("zoe", "cancelado", 20, f"{8 + i % 10:02d}:{i:02d}", [("Refresco", 1)], "retiro", None, None, 50) for i in range(27)]

for cli, estado, dias, hora, items, entrega, direccion, notas, tasa in pedidos:
    tel, nombre = clientes[cli]
    q = lambda v: "null" if v is None else "$q$" + v + "$q$"
    sql(f"""
    with p as (select id, nombre, precio_usd from public.productos where negocio_id='{NV}'),
    lineas(nombre, cant) as (values {",".join(f"($q${n}$q$, {c})" for n, c in items)}),
    ped as (
      insert into public.pedidos (negocio_id, cliente_id, cliente_telefono, cliente_nombre, total_usd, tasa_bs, estado, entrega, direccion, notas, created_at)
      select '{NV}', (select id from public.clientes where negocio_id='{NV}' and telefono='{tel}'), '{tel}', '{nombre}',
             (select sum(p.precio_usd * l.cant) from lineas l join p on p.nombre = l.nombre), {tasa}, '{estado}', '{entrega}', {q(direccion)}, {q(notas)}, {ts(dias, hora)}
      returning id)
    insert into public.pedido_items (pedido_id, negocio_id, producto_id, nombre_producto, cantidad, precio_unitario_usd)
    select ped.id, '{NV}', p.id, p.nombre, l.cant, p.precio_usd from ped, lineas l join p on p.nombre = l.nombre;""")
sql(f"""update public.clientes c set ultima_compra = coalesce((select max(created_at) from public.pedidos p where p.cliente_id = c.id), c.ultima_compra) where negocio_id='{NV}'""")
print(sql(f"select estado, count(*), sum(total_usd) from public.pedidos where negocio_id='{NV}' group by 1 order by 1"))
