#!/bin/bash
# Crea agente/.env a partir de .env.example con secretos nuevos (si todavía no existe).
# Las claves de Supabase y OpenRouter las pegas tú en .env (nunca en un chat).
set -eu
cd "$(dirname "$0")/.."
if [ -f .env ]; then echo ".env ya existe: no se toca."; exit 0; fi
cp .env.example .env
chmod 600 .env
for v in EVOLUTION_API_KEY POSTGRES_PASSWORD REDIS_PASSWORD AGENTE_WEBHOOK_SECRET AGENTE_INTERNO_SECRET; do
  sed -i "s|^$v=.*|$v=$(openssl rand -hex 32)|" .env
done
echo "Listo: agente/.env creado con secretos nuevos."
echo "Falta que completes: SUPABASE_URL, SUPABASE_SERVICE_KEY y OPENROUTER_API_KEY."
