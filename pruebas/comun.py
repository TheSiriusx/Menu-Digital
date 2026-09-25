"""TOTP (RFC 6238) y sesiones aal2 para los scripts de mantenimiento de pruebas."""
import base64, hashlib, hmac, json, os, struct, sys, time, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from db import _entorno

def totp(secreto, t=None):
    t = time.time() if t is None else t
    clave = base64.b32decode(secreto.replace(" ", "").upper() + "=" * (-len(secreto.replace(" ", "")) % 8))
    h = hmac.new(clave, struct.pack(">Q", int(t // 30)), hashlib.sha1).digest()
    o = h[19] & 0xF
    return str((struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 1_000_000).zfill(6)

def _pedir(ruta, datos=None, metodo="POST", token=None):
    e = _entorno()
    cab = {"apikey": e["NEXT_PUBLIC_SUPABASE_ANON_KEY"], "Content-Type": "application/json", "User-Agent": "curl/8"}
    if token: cab["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(e["NEXT_PUBLIC_SUPABASE_URL"] + ruta, data=json.dumps(datos if datos is not None else {}).encode() if metodo != "GET" else None, headers=cab, method=metodo)
    try:
        with urllib.request.urlopen(r, timeout=30) as x: return json.loads(x.read() or b"null")
    except urllib.error.HTTPError as ex:
        raise SystemExit(f"ERROR {ruta}: {ex.code} {ex.read().decode()[:300]}")

def iniciar_sesion(correo, clave):
    return _pedir("/auth/v1/token?grant_type=password", {"email": correo, "password": clave})["access_token"]

def inscribir_totp(correo, clave, nombre="e2e"):
    """Inscribe y verifica un factor TOTP por la API. Devuelve (secreto, codigo_usado)."""
    tok = iniciar_sesion(correo, clave)
    f = _pedir("/auth/v1/factors", {"factor_type": "totp", "friendly_name": nombre, "issuer": "e2e"}, token=tok)
    secreto = f["totp"]["secret"]
    desafio = _pedir(f"/auth/v1/factors/{f['id']}/challenge", {}, token=tok)
    codigo = totp(secreto)
    _pedir(f"/auth/v1/factors/{f['id']}/verify", {"challenge_id": desafio["id"], "code": codigo}, token=tok)
    return secreto, codigo

def token_aal2(correo, clave, secreto, usados=()):
    """Sesión con segundo factor verificado (aal2) para llamar a la API como super admin."""
    tok = iniciar_sesion(correo, clave)
    factores = _pedir("/auth/v1/factors", metodo="GET", token=tok) if False else None
    # el factor se obtiene del usuario
    u = _pedir("/auth/v1/user", metodo="GET", token=tok)
    factor = next(f for f in u["factors"] if f["status"] == "verified")
    desafio = _pedir(f"/auth/v1/factors/{factor['id']}/challenge", {}, token=tok)
    while True:
        codigo = totp(secreto)
        if codigo not in usados: break
        time.sleep(1.5)
    r = _pedir(f"/auth/v1/factors/{factor['id']}/verify", {"challenge_id": desafio["id"], "code": codigo}, token=tok)
    return r["access_token"], codigo
