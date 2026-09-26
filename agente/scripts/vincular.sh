#!/bin/bash
# Muestra el QR para vincular el WhatsApp de un local y lo renueva solo (caduca a los ~40 s) hasta que se
# escanee o pasen 3 minutos.   ./scripts/vincular.sh menu-nueva-victoria
set -eu
cd "$(dirname "$0")/.."
INST="${1:?Uso: ./scripts/vincular.sh <instancia>}"
set -a; . ./.env; set +a
EVO="http://127.0.0.1:8090"
estado() { curl -s -m 10 -H "apikey: $EVOLUTION_API_KEY" "$EVO/instance/connectionState/$INST" | python3 -c "import json,sys; print(json.load(sys.stdin).get('instance',{}).get('state','?'))" 2>/dev/null || echo "?"; }
mkdir -p datos
abierto=no
for vuelta in $(seq 1 9); do
  [ "$(estado)" = "open" ] && { echo "✅ «$INST» conectada."; exit 0; }
  curl -s -m 30 -H "apikey: $EVOLUTION_API_KEY" "$EVO/instance/connect/$INST" | python3 -c '
import base64, json, sys
d = json.load(sys.stdin)
b = (d.get("base64") or "").split(",", 1)[-1]
if b: open("datos/qr.png", "wb").write(base64.b64decode(b))' || true
  if [ "$abierto" = no ] && [ -s datos/qr.png ]; then
    (command -v xdg-open >/dev/null && xdg-open datos/qr.png >/dev/null 2>&1 &) ; abierto=si
    echo "QR abierto (agente/datos/qr.png). En el teléfono: WhatsApp → Dispositivos vinculados → Vincular un dispositivo."
  fi
  for i in $(seq 1 10); do sleep 2; [ "$(estado)" = "open" ] && { echo "✅ «$INST» conectada."; exit 0; }; done
  echo "   (QR renovado)"
done
echo "No se escaneó en 3 minutos. Vuelve a correr el script."; exit 1
