#!/bin/bash
# Simula un mensaje entrante (como lo mandaría Evolution) sin usar WhatsApp.
# OJO: el agente RESPONDE de verdad por WhatsApp al número de prueba. Usa SIEMPRE números 999… (no existen).
#   ./scripts/simular.sh "hola, ¿tienen canillas?"            [telefono]
#   INSTANCIA=menu-otro NEGOCIO=58412... ./scripts/simular.sh "hola"
set -eu
cd "$(dirname "$0")/.."
set -a; . ./.env; set +a
TEXTO="${1:-hola}"; TEL="${2:-999000000001}"
case "$TEL" in 999*) ;; *) echo "Solo números de prueba 999…"; exit 1 ;; esac
python3 - "$TEXTO" "$TEL" "${INSTANCIA:-menu-nueva-victoria}" "${NEGOCIO:-999000000099}" <<'PY' > /tmp/sim.json
import json, sys, time
texto, tel, inst, negocio = sys.argv[1:5]
print(json.dumps({"event": "messages.upsert", "instance": inst, "sender": f"{negocio}@s.whatsapp.net",
  "data": {"key": {"remoteJid": f"{tel}@s.whatsapp.net", "fromMe": False, "id": f"SIM{time.time_ns()}"},
           "pushName": "Prueba", "message": {"conversation": texto}}}))
PY
curl -s -m 15 -X POST http://127.0.0.1:3010/webhook -H "x-webhook-secret: $AGENTE_WEBHOOK_SECRET" -H "Content-Type: application/json" --data @/tmp/sim.json
echo; rm -f /tmp/sim.json
echo "Mira la respuesta con:  docker logs -f panaderias_agente"
