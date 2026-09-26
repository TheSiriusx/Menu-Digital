"""Humo del agente con la IA real y Supabase real (WhatsApp simulado). Deja la base como estaba.
Uso: python3 pruebas/agente-humo.py"""
import os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import sql
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
env = dict(os.environ)
for l in open(os.path.join(RAIZ, "agente", ".env"), encoding="utf-8"):
    m = re.match(r"^([A-Z_]+)=(.*)$", l.strip())
    if m: env[m.group(1)] = m.group(2)
sql("update public.negocios set evolution_instance_name = 'menu-nueva-victoria' where slug = 'nueva-victoria'")
try:
    nvm = os.path.expanduser("~/.var/app/com.visualstudio.code/config/nvm/nvm.sh")
    r = subprocess.run(["bash", "-c", f'. "{nvm}" && nvm use --lts >/dev/null && node --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON test/humo-ia.ts'],
                       cwd=os.path.join(RAIZ, "agente"), capture_output=True, text=True, timeout=900, env=env)
    salida = r.stdout + r.stderr
    for k in ("SUPABASE_SERVICE_KEY", "OPENROUTER_API_KEY"):
        salida = salida.replace(env.get(k, "@@"), "<oculta>")
    print(salida)
finally:
    print("pedidos creados:", sql("select estado, total_usd, cliente_telefono from public.pedidos"))
    subprocess.run(["python3", os.path.join(RAIZ, "pruebas", "limpiar.py"), "--datos"], capture_output=True)
    print("limpio:", sql("select (select count(*) from public.pedidos) p, (select evolution_instance_name from public.negocios where slug='nueva-victoria') i")[0])
