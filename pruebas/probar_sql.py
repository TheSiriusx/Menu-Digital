"""Ejecuta una batería SQL (que termina en RAISE a propósito) y muestra sus resultados.
Uso: python3 pruebas/probar_sql.py pruebas/sql/agente11.sql [--con-migraciones 0010 0011]
Con --con-migraciones aplica esas migraciones DENTRO de la misma transacción: al terminar en error, nada queda guardado."""
import glob, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import sql

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
args = sys.argv[1:]
prueba = open(args[0], encoding="utf-8").read()
partes = ["begin;"]
if "--con-migraciones" in args:
    for num in args[args.index("--con-migraciones") + 1:]:
        ruta = glob.glob(os.path.join(RAIZ, "supabase", "migrations", f"{num}_*.sql"))[0]
        texto = open(ruta, encoding="utf-8").read()
        partes.append(re.sub(r"(?im)^\s*(begin|commit);\s*$", "", texto))
partes.append(prueba)
try:
    sql("\n".join(partes))
    print("ERROR: la batería no terminó con RAISE (¿se habrá guardado algo?)")
    sys.exit(2)
except SystemExit as e:
    m = str(e)
    if "RESULTADOS" not in m:
        print(m[:3000]); sys.exit(1)
    texto = json.loads(m[m.index("{"):])["message"].split("RESULTADOS\n", 1)[1]
    print(re.sub(r"\nCONTEXT:.*", "", texto).rstrip())
    sys.exit(0 if re.search(r"(\d+) de \1 pruebas", texto) else 1)
