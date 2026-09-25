#!/bin/sh
# Reinicia Firefox headless con perfil nuevo (solo admite UNA sesión BiDi por proceso). Se ejecuta en el host:
#   flatpak-spawn --host --directory=/tmp sh "$PWD/pruebas/firefox.sh"
kill $(cat /tmp/ff-cc.pid) 2>/dev/null; sleep 2
rm -rf /tmp/ffprof-cc; mkdir -p /tmp/ffprof-cc
nohup firefox --headless --no-remote --profile /tmp/ffprof-cc --remote-debugging-port 9222 >/tmp/ff-cc.log 2>&1 &
echo $! > /tmp/ff-cc.pid
for i in $(seq 1 30); do ss -ltn | grep -q 9222 && break; sleep 1; done
ss -ltn | grep -c 9222
