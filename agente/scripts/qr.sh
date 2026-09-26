#!/bin/bash
# QR para vincular el WhatsApp de un local. Caduca en ~40 s: si no llegas, vuelve a correrlo.
#   ./scripts/qr.sh menu-nueva-victoria
set -eu
cd "$(dirname "$0")/.."
INST="${1:?Uso: ./scripts/qr.sh <instancia>}"
set -a; . ./.env; set +a
EVO="http://127.0.0.1:8090"
ESTADO=$(curl -s -m 15 -H "apikey: $EVOLUTION_API_KEY" "$EVO/instance/connectionState/$INST" \
  | python3 -c "import json,sys; print(json.load(sys.stdin).get('instance',{}).get('state','?'))" 2>/dev/null || echo "?")
if [ "$ESTADO" = "open" ]; then echo "«$INST» ya está conectada."; exit 0; fi
mkdir -p datos
curl -s -m 30 -H "apikey: $EVOLUTION_API_KEY" "$EVO/instance/connect/$INST" | python3 -c '
import base64, json, sys
d = json.load(sys.stdin)
b = (d.get("base64") or "").split(",", 1)[-1]
if not b: sys.exit("Sin QR: " + json.dumps(d)[:200])
open("datos/qr.png", "wb").write(base64.b64decode(b))
print("QR en agente/datos/qr.png" + (" · código: " + d["pairingCode"] if d.get("pairingCode") else ""))'
command -v xdg-open >/dev/null && xdg-open datos/qr.png >/dev/null 2>&1 || true
echo "En el teléfono: WhatsApp → Dispositivos vinculados → Vincular un dispositivo."
