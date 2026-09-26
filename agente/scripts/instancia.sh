#!/bin/bash
# Conecta una panadería del menú digital con WhatsApp: crea su instancia en Evolution (menu-{slug}),
# apunta sus mensajes al agente y la registra en el local (Supabase). Se puede volver a correr.
#   ./scripts/instancia.sh nueva-victoria        y luego   ./scripts/qr.sh menu-nueva-victoria
set -eu
cd "$(dirname "$0")/.."
SLUG="${1:?Uso: ./scripts/instancia.sh <slug-del-local>}"
[[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || { echo "slug no válido"; exit 1; }
set -a; . ./.env; set +a
INST="menu-$SLUG"
EVO="http://127.0.0.1:8090"
WEBHOOK="http://agente:3000/webhook?secreto=$AGENTE_WEBHOOK_SECRET"

echo "== Instancia $INST"
CODIGO=$(curl -s -o /tmp/evo.json -w "%{http_code}" -m 30 -X POST "$EVO/instance/create" \
  -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" \
  -d "{\"instanceName\":\"$INST\",\"integration\":\"WHATSAPP-BAILEYS\",\"qrcode\":true}")
case "$CODIGO" in
  200|201) echo "   creada" ;;
  403) echo "   ya existía: se reutiliza" ;;
  *) echo "   Evolution respondió $CODIGO"; exit 1 ;;
esac
rm -f /tmp/evo.json

echo "== Mensajes -> agente (solo mensajes, con audios y fotos incluidos)"
curl -s -f -m 30 -X POST "$EVO/webhook/set/$INST" -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" \
  -d "{\"webhook\":{\"enabled\":true,\"url\":\"$WEBHOOK\",\"webhookByEvents\":false,\"base64\":true,\"events\":[\"MESSAGES_UPSERT\"]}}" >/dev/null \
  && echo "   listo" || { echo "   no se pudo configurar el webhook"; exit 1; }

echo "== Registrar la instancia en el local «$SLUG» (Supabase)"
FILAS=$(curl -s -m 30 -X PATCH "$SUPABASE_URL/rest/v1/negocios?slug=eq.$SLUG" \
  -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"evolution_instance_name\":\"$INST\"}" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
[ "$FILAS" = "1" ] && echo "   listo" || { echo "   no existe un local con el slug «$SLUG»"; exit 1; }
echo
echo "Ahora vincula el WhatsApp del local:  ./scripts/qr.sh $INST   (o desde el panel → Configuración)"
