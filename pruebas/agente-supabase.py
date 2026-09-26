"""Corre agente/test/integracion-supabase.ts contra el Supabase real y deja todo como estaba.
Uso: python3 pruebas/agente-supabase.py"""
import json, os, subprocess, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import sql, _entorno, REF
from foto import tomar

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
e = _entorno()
req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/api-keys", headers={"Authorization": "Bearer " + e["SUPABASE_ACCESS_TOKEN"], "User-Agent": "curl/8"})
claves = json.loads(urllib.request.urlopen(req, timeout=30).read())
srv = next(k["api_key"] for k in claves if k["name"] == "service_role")
tomar()
sql("update public.negocios set evolution_instance_name = 'menu-nueva-victoria' where slug = 'nueva-victoria'")
try:
    nvm = os.path.expanduser("~/.var/app/com.visualstudio.code/config/nvm/nvm.sh")
    cmd = f'. "{nvm}" && nvm use --lts >/dev/null && node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON test/integracion-supabase.ts'
    r = subprocess.run(["bash", "-c", cmd], cwd=os.path.join(RAIZ, "agente"), capture_output=True, text=True, timeout=180,
                       env={**os.environ, "SUPABASE_URL": e["NEXT_PUBLIC_SUPABASE_URL"], "SUPABASE_SERVICE_KEY": srv})
    print((r.stdout + r.stderr).replace(srv, "<oculta>"))
finally:
    subprocess.run(["python3", os.path.join(RAIZ, "pruebas", "limpiar.py")], capture_output=True)
    print("limpio:", sql("select (select count(*) from public.pedidos) pedidos, (select count(*) from public.agente_avisos) avisos, (select evolution_instance_name from public.negocios where slug='nueva-victoria') instancia")[0])
