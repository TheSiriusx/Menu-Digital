"""Deja la base como estaba: borra usuarios y datos de prueba y devuelve Nueva Victoria a la foto tomada antes de probar.
Uso: python3 pruebas/limpiar.py   (tras cualquier batería de pruebas de navegador)."""
import json, os, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import sql, _entorno, REF
from foto import ARCHIVO as FOTO, iguales, leer, restaurar

S = os.path.dirname(os.path.abspath(__file__))
SOLO_STORAGE = "--storage" in sys.argv   # solo vacía Storage (entre baterías)
SIN_USUARIOS = "--datos" in sys.argv    # restaura los datos pero conserva los usuarios temporales
NV = sql("select id from public.negocios where slug='nueva-victoria'")[0]["id"]

if not SOLO_STORAGE:
    # Locales de prueba (creados por las pruebas del super admin).
    sql("delete from public.negocios where slug like 'e2e-%' or slug like 'local-e2e%' or slug in ('local-wa-prueba','local-falla','adoptada')")
    foto = leer()
    if foto:
        restaurar(foto)   # Nueva Victoria vuelve EXACTAMENTE como estaba antes de las pruebas
    else:
        print("AVISO: no hay foto de los datos reales (pruebas/foto-real.json): Nueva Victoria no se restauró.")
    if not SIN_USUARIOS:
        sql("delete from auth.users where email like 'e2e-%@starcklabs.test'")

# Storage: el borrado directo por SQL está prohibido; se usa la API con la clave de servicio, solo aquí y sin imprimirla.
e = _entorno()
def pedir(url, metodo="GET", cab=None, cuerpo=None):
    r = urllib.request.Request(url, method=metodo, data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
                               headers={"User-Agent": "curl/8", "Content-Type": "application/json", **(cab or {})})
    with urllib.request.urlopen(r, timeout=30) as x: return json.loads(x.read() or b"null")
reales = set((leer() or {}).get("storage", []))
restos = [o["name"] for o in sql("select name from storage.objects where bucket_id='menu-media'") if o["name"] not in reales]
if restos:
    claves = pedir(f"https://api.supabase.com/v1/projects/{REF}/api-keys", cab={"Authorization": "Bearer " + e["SUPABASE_ACCESS_TOKEN"]})
    srv = next(k["api_key"] for k in claves if k["name"] == "service_role")
    pedir(f"{e['NEXT_PUBLIC_SUPABASE_URL']}/storage/v1/object/menu-media", "DELETE", {"Authorization": "Bearer " + srv, "apikey": srv}, {"prefixes": restos})

if leer() and not SOLO_STORAGE:
    print("datos reales de Nueva Victoria restaurados:", iguales(leer()))
if not SOLO_STORAGE and not SIN_USUARIOS:
    for f in ("e2e4.env", "e2e.env"):
        if os.path.exists(f"{S}/{f}"): os.remove(f"{S}/{f}")
    if os.path.exists(FOTO): os.remove(FOTO)   # fin de la sesión de pruebas
print(sql("""select (select count(*) from auth.users) usuarios, (select count(*) from public.perfiles) perfiles,
  (select count(*) from public.negocios) negocios, (select count(*) from public.categorias) categorias, (select count(*) from public.productos) productos,
  (select count(*) from public.pedidos) pedidos, (select count(*) from public.clientes) clientes, (select count(*) from storage.objects) objetos""")[0])
