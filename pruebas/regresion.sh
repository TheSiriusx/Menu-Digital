#!/bin/sh
# Ejecuta las baterías de navegador una tras otra (Firefox nuevo para cada una). Requiere servidor en :3100,
# usuarios de preparar.py y (para panelb) datos de sembrar_b.py. Resultado en pruebas/logs/<nombre>.log
export NVM_DIR="$HOME/.var/app/com.visualstudio.code/config/nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use --lts >/dev/null
cd "$(dirname "$0")/e2e" || exit 1
mkdir -p ../logs
for t in "$@"; do
  python3 ../limpiar.py --datos >/dev/null 2>&1; case "$t" in panelb|asistente) python3 ../sembrar_b.py >/dev/null 2>&1;; esac
  flatpak-spawn --host --directory=/tmp sh "$(cd .. && pwd)/firefox.sh" >/dev/null 2>&1
  timeout 900 node "$t.mjs" > "../logs/$t.log" 2>&1
  echo "$t: $(grep -E 'pruebas correctas|pantallas|bien estiladas' ../logs/$t.log | tail -1) | fallas: $(grep -c '^FALLA' ../logs/$t.log)"
done
