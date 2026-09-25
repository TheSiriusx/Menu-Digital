"""Ayudante temporal: ejecuta SQL en Supabase con el token de .env.local (no imprime secretos)."""
import json, os, sys, urllib.request

def _entorno():
    datos = {}
    for linea in open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env.local"), encoding="utf-8"):
        if "=" in linea and not linea.startswith("#"):
            k, v = linea.rstrip("\n").split("=", 1)
            datos[k] = v
    return datos

REF = "ortspggciycnybspqelq"

def sql(consulta):
    token = _entorno()["SUPABASE_ACCESS_TOKEN"]
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": consulta}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "curl/8"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ERROR SQL {e.code}: {e.read().decode()[:20000]}")
