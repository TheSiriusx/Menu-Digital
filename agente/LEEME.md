# Agente de WhatsApp para panaderías

Atiende el WhatsApp de cada panadería del menú digital: responde dudas con el menú real, toma pedidos (desde el
menú web y por conversación), avisa al cliente cuando cambia el estado de su pedido y le pasa a una persona lo que
no debe resolver solo. Todo lo del negocio (menú, pedidos, clientes, configuración) vive en Supabase; el agente
solo guarda las conversaciones (SQLite, en el volumen `agente_datos`).

## Qué hace

| Situación | Qué pasa | ¿IA? |
|---|---|---|
| Llega el mensaje del menú web `[[PEDIDO v1\|…]]` | Registra el pedido (`crear_pedido`), responde con el total real y los datos de pago, avisa al dueño | No |
| «quiero 2 canillas y un café» | La IA arma el pedido → el sistema muestra el resumen → **solo con un «sí»** se registra | Sí (propone) |
| Pregunta por precios, productos, horario, delivery | Responde con el menú y la configuración reales | Sí |
| «¿Cómo va mi pedido?» / «cancélalo» | Consulta sus pedidos; cancela solo si está «nuevo» (devuelve stock) | Sí (herramientas) |
| Encargo (torta para el sábado…) | Pregunta fecha, sabor, dedicatoria, foto y entrega → resumen al dueño y se calla 24 h | Sí |
| Foto | Con un pedido pendiente: comprobante → al dueño con el pedido. Si no: referencia → al dueño | No |
| Audio | Whisper (local) lo pasa a texto y sigue como texto | No |
| Alergias, ingredientes, quejas | Responde que una persona lo atiende, avisa al dueño y se calla 3 h | No |
| El dueño cambia el estado en el panel | Aviso al cliente: confirmado (con datos de pago si así está configurado), pagado, listo/en camino, entregado, cancelado | No |
| Pedido «nuevo» sin atender | Recordatorio al dueño a los 10 y 30 min (configurable) | No |
| Entregado | Pide reseña ~2 h después, con el enlace del local | No |
| El dueño le escribe a mano a un cliente | El agente se calla con ese cliente 2 h | No |
| El dueño en su chat consigo mismo | `pedidos`, `apagar`, `apagar 3h`, `encender`, `ayuda` | No |

Nunca confirma pagos, nunca inventa precios (el total lo calcula la base de datos) y el local siempre sale de la
instancia de WhatsApp por la que llegó el mensaje. Cada local se configura en su panel → Configuración →
«Asistente de WhatsApp».

## Puesta en marcha (en tu PC)

```bash
cd agente
./scripts/preparar.sh                 # crea .env con secretos nuevos
# edita .env: SUPABASE_URL, SUPABASE_SERVICE_KEY (Supabase → Project Settings → API) y OPENROUTER_API_KEY
docker compose up -d --build          # agente + Evolution + Postgres + Redis + Whisper (nombres panaderias_*)
./scripts/instancia.sh nueva-victoria # crea «menu-nueva-victoria», la apunta al agente y la registra en el local
./scripts/qr.sh menu-nueva-victoria   # escanéalo con el WhatsApp de la panadería
./scripts/simular.sh "hola, ¿tienen canillas?"   # prueba sin WhatsApp (solo números 999…)
docker logs -f panaderias_agente
```

Es un stack aparte del bot de uñas: otros contenedores, otra red, otros puertos. Solo se abren en esta máquina
Evolution (`127.0.0.1:8090`) y el agente (`127.0.0.1:3010`).

## Que la web (Vercel) vea tu Evolution: Tailscale Funnel

Para que el dueño escanee el QR desde su panel y el super admin cree instancias, Vercel necesita una dirección
HTTPS fija hacia Evolution:

```bash
sudo tailscale up                 # una vez; inicia sesión
sudo tailscale funnel --bg 8090   # publica 127.0.0.1:8090 como https://<tu-pc>.<tu-red>.ts.net
```

En Vercel (Settings → Environment Variables, solo servidor) y luego redeploy:

| Variable | Valor |
|---|---|
| `EVOLUTION_API_URL` | `https://<tu-pc>.<tu-red>.ts.net` |
| `EVOLUTION_API_KEY` | el de `agente/.env` |
| `AGENTE_WEBHOOK_URL` | `http://agente:3000/webhook` (la ve Evolution dentro de Docker, no internet) |
| `AGENTE_WEBHOOK_SECRET` | el de `agente/.env` |

Y en `agente/.env`, `EVOLUTION_URL_PUBLICA` = la misma dirección de Funnel. Si tu PC se apaga, el bot deja de
atender: para clientes reales, un VPS (el mismo `docker compose` + Caddy delante de Evolution).

## Pruebas

```bash
npm test                               # 50 pruebas: reglas, flujo completo con IA simulada, avisos, servidor
npm run check                          # tipos
python3 ../pruebas/agente-supabase.py  # contra el Supabase real (números 999, deja todo limpio)
```

## Archivos

```
src/flujo.ts        qué se hace con cada mensaje (reglas duras → IA)
src/herramientas.ts lo que puede pedir la IA (preparar_pedido, ver_mis_pedidos, cancelar_pedido, registrar_encargo, pasar_a_humano)
src/pedidos.ts      registrar un pedido y sus mensajes fijos
src/avisos.ts       avisos de estado, reseñas y recordatorios (cola agente_avisos de Supabase)
src/reglas.ts       «sí»/«no», alergias, comandos del dueño · src/horario.ts horario en hora de Venezuela
src/clientes.ts     Supabase, Evolution y Whisper · src/ia.ts OpenRouter con reintentos y modelos de respaldo
src/almacen.ts      conversaciones, pausas y borradores (SQLite) · src/servidor.ts /webhook, /interno/avisos, /salud
```

## Seguridad

- `SUPABASE_SERVICE_KEY` da acceso total: solo en `agente/.env` (fuera del repositorio). Si se filtra, rótala.
- El webhook exige `AGENTE_WEBHOOK_SECRET` (cabecera `x-webhook-secret` o `?secreto=`) y no está publicado en internet.
- La IA no elige el local, el cliente ni su teléfono, ni fija precios: lo hace el código con la base de datos.
- El texto del cliente nunca entra en las instrucciones del sistema; alergias y quejas no pasan por la IA.
- Límite de 40 mensajes por hora por cliente (abuso o un bucle con otro bot).
- Evolution usa la conexión no oficial de WhatsApp Web: evita mensajes masivos no pedidos (riesgo de bloqueo).
