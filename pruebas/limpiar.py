"""Deja la base como estaba: borra usuarios y datos de prueba y restaura Nueva Victoria (valores del seed).
Uso: python3 pruebas/limpiar.py   (tras cualquier batería de pruebas de navegador)."""
import json, os, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import sql, _entorno, REF

S = os.path.dirname(os.path.abspath(__file__))
SOLO_STORAGE = "--storage" in sys.argv   # solo vacía Storage (entre baterías)
SIN_USUARIOS = "--datos" in sys.argv    # restaura los datos pero conserva los usuarios temporales
NV = sql("select id from public.negocios where slug='nueva-victoria'")[0]["id"]

if not SOLO_STORAGE:
    # Locales de prueba (creados por las pruebas del super admin) y pedidos/clientes sembrados.
    sql("delete from public.negocios where slug like 'e2e-%' or slug like 'local-e2e%' or slug in ('local-wa-prueba','local-falla','adoptada')")
    sql(f"""
    begin;
    delete from public.pedidos  where negocio_id='{NV}';   -- (borra también sus items)
    delete from public.clientes where negocio_id='{NV}';
    delete from public.categorias where negocio_id='{NV}' and nombre not in ('Panes','Dulces','Bebidas','Especiales');
    insert into public.categorias (negocio_id, nombre, orden)
      select '{NV}', 'Bebidas', 3 where not exists (select 1 from public.categorias where negocio_id='{NV}' and nombre='Bebidas');
    update public.categorias set orden = case nombre when 'Panes' then 1 when 'Dulces' then 2 when 'Bebidas' then 3 when 'Especiales' then 4 end, activa = true where negocio_id='{NV}';
    delete from public.productos where negocio_id='{NV}' and nombre not in ('Pan canilla','Pan sobado','Pan integral','Pan campesino','Cachito de jamón','Croissant','Golfeado','Quesillo','Torta de chocolate','Café marrón','Café con leche','Jugo natural','Refresco','Pan de jamón','Tequeños x10','Torta de cumpleaños');
    update public.productos p set categoria_id = c.id from public.categorias c
      where p.negocio_id='{NV}' and c.negocio_id='{NV}' and c.nombre = case
        when p.nombre in ('Pan canilla','Pan sobado','Pan integral','Pan campesino') then 'Panes'
        when p.nombre in ('Cachito de jamón','Croissant','Golfeado','Quesillo','Torta de chocolate') then 'Dulces'
        when p.nombre in ('Café marrón','Café con leche','Jugo natural','Refresco') then 'Bebidas'
        else 'Especiales' end;
    update public.productos p set precio_usd=v.precio, disponible=v.disp, stock=null, foto_url=null, orden=v.orden
      from (values ('Pan canilla',0.50,true,1),('Pan sobado',0.30,true,2),('Pan integral',1.20,true,3),('Pan campesino',1.00,true,4),
        ('Cachito de jamón',1.50,true,1),('Croissant',1.80,true,2),('Golfeado',1.50,false,3),('Quesillo',2.00,true,4),('Torta de chocolate',2.50,true,5),
        ('Café marrón',1.00,true,1),('Café con leche',1.50,true,2),('Jugo natural',1.80,false,3),('Refresco',1.00,true,4),
        ('Pan de jamón',3.50,true,1),('Tequeños x10',6.00,true,2),('Torta de cumpleaños',18.00,true,3)) as v(nombre,precio,disp,orden)
      where p.negocio_id='{NV}' and p.nombre = v.nombre;
    -- Datos de ejemplo de Nueva Victoria (seed.sql; el color es el que tenía el local).
    update public.negocios set nombre='Panadería Nueva Victoria', color='#BDAB64', tasa_bs=50, telefono_whatsapp='584120000000',
      horario='Lunes a sábado 6:00 am – 7:00 pm · Domingos 6:00 am – 1:00 pm', activo=true, logo_url=null, evolution_instance_name=null where id='{NV}';
    commit;""")
    if not SIN_USUARIOS:
        sql("delete from auth.users where email like 'e2e-%@starcklabs.test'")


# Storage: el borrado directo por SQL está prohibido; se usa la API con la clave de servicio, solo aquí y sin imprimirla.
e = _entorno()
def pedir(url, metodo="GET", cab=None, cuerpo=None):
    r = urllib.request.Request(url, method=metodo, data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
                               headers={"User-Agent": "curl/8", "Content-Type": "application/json", **(cab or {})})
    with urllib.request.urlopen(r, timeout=30) as x: return json.loads(x.read() or b"null")
restos = [o["name"] for o in sql("select name from storage.objects where bucket_id='menu-media'")]
if restos:
    claves = pedir(f"https://api.supabase.com/v1/projects/{REF}/api-keys", cab={"Authorization": "Bearer " + e["SUPABASE_ACCESS_TOKEN"]})
    srv = next(k["api_key"] for k in claves if k["name"] == "service_role")
    pedir(f"{e['NEXT_PUBLIC_SUPABASE_URL']}/storage/v1/object/menu-media", "DELETE", {"Authorization": "Bearer " + srv, "apikey": srv}, {"prefixes": restos})

if not SOLO_STORAGE and not SIN_USUARIOS:
    for f in ("e2e4.env", "e2e.env"):
        if os.path.exists(f"{S}/{f}"): os.remove(f"{S}/{f}")
print(sql("""select (select count(*) from auth.users) usuarios, (select count(*) from public.perfiles) perfiles,
  (select count(*) from public.negocios) negocios, (select count(*) from public.categorias) categorias, (select count(*) from public.productos) productos,
  (select count(*) from public.pedidos) pedidos, (select count(*) from public.clientes) clientes, (select count(*) from storage.objects) objetos""")[0])
