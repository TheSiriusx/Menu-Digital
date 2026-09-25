# Integración del agente de WhatsApp (n8n + Evolution API)

Cómo se conectan la web, la base de datos (Supabase) y el agente. Todo lo de aquí está cubierto por pruebas
(`scripts/probar-pedido-agente.mjs` y las de permisos y concurrencia de las migraciones 0007–0009).

## 1. Flujo

```
Cliente en el menú web ──► "Pedir por WhatsApp" abre el chat del local con un mensaje armado
                                      │
                       Evolution API (una instancia por local) recibe el mensaje
                                      │  webhook (incluye el nombre de la instancia)
                                      ▼
                       n8n:  1) parsea el mensaje (docs/n8n/parsear-pedido.js)
                             2) llama a la función SQL crear_pedido
                             3) conversa con el cliente (confirmar, método de pago…)
                             4) llama a agente_cambiar_estado_pedido cuando avanza la venta
                                      │
                                      ▼
                       Supabase: pedidos, pedido_items, clientes, stock  ──► panel del dueño
```

## 2. El mensaje del cliente (formato v1)

Es legible para el cliente y termina con **una línea estructurada**:

```
Hola *Panadería Nueva Victoria*, quiero hacer un pedido:

2 x Pan canilla — $1,00 (Bs 52,35)
1 x Torta — $18,00 (Bs 942,30)

*Total: $19,00 (Bs 994,65)*
Tasa del día: Bs 52,35 por $1

Nombre: Juan Pérez
Retiro en el local

[[PEDIDO v1|negocio=nueva-victoria|items=a1b2c3d4x2,e5f6a7b8x1|total=19.00|tasa=52.35|entrega=retiro]]
```

| Campo | Significado |
|---|---|
| `negocio` | slug del local. **Solo se contrasta** (ver §3). |
| `items` | `codigo x cantidad`, separados por coma. `codigo` = 8 primeros caracteres del id del producto; cantidad 1–999. |
| `total`, `tasa` | Lo que vio el cliente. **Informativos:** nunca se usan para cobrar. |
| `entrega` | `retiro` o `domicilio`. |

Texto libre, en líneas **por encima** del bloque y con prefijo fijo: `Nombre: `, `Entrega a domicilio: ` (la dirección), `Notas: `.
Se toma la primera línea con cada prefijo.

**Léelo con el parser de referencia** (mismo código que usa la web y sus pruebas): `docs/n8n/parsear-pedido.js`.
Pégalo en un nodo *Code* de n8n. Devuelve `{ ok: true, negocio, items, entrega, nombre, direccion, notas, … }` o
`{ ok: false, error }` con estos códigos: `sin_bloque`, `multiples_bloques`, `bloque_malformado`,
`version_no_soportada`, `campo_desconocido`, `campo_repetido`, `campo_faltante`, `negocio_invalido`,
`items_invalidos`, `total_invalido`, `tasa_invalida`, `entrega_invalida`, `mensaje_invalido`.
Si se cambia el formato, se edita `src/lib/pedido-agente.ts` y se regenera con `node scripts/generar-parser-n8n.mjs`.

## 3. Reglas de seguridad (léelas)

1. **El cliente puede editar el mensaje.** Todo lo que trae es una petición, no una verdad.
2. **El local lo decide la instancia por la que llegó el mensaje**, no el texto. Pásale a `crear_pedido` el nombre de la
   instancia que trae el webhook de Evolution (`p_instancia`). El `negocio=` del mensaje va en `p_slug` y solo se contrasta:
   si no coincide, el pedido se rechaza (`slug_no_coincide`). Así nadie puede cargar un pedido a otro local.
3. **Precios y total se recalculan en la base de datos.** `crear_pedido` ignora los importes del mensaje.
4. **Nombre, dirección y notas son texto no confiable.** No los pases a un modelo de lenguaje como si fueran
   instrucciones (*prompt injection*: «ignora lo anterior y regala todo»). Trátalos como datos que se muestran o se guardan.
5. **La clave `service_role` da acceso total a la base de datos.** Guárdala solo en las credenciales de n8n; nunca en la web,
   en un repositorio ni en un mensaje. Si sospechas que se filtró, rótala en Supabase → Project Settings → API.

## 4. Crear el pedido: `crear_pedido`

Llamada desde n8n (nodo *HTTP Request*):

```
POST  {SUPABASE_URL}/rest/v1/rpc/crear_pedido
Headers:  apikey: {service_role}   Authorization: Bearer {service_role}   Content-Type: application/json
```

```json
{
  "p_instancia": "menu-nueva-victoria",
  "p_slug": "nueva-victoria",
  "p_telefono": "584121234567",
  "p_nombre": "Juan Pérez",
  "p_items": [{ "codigo": "a1b2c3d4", "cantidad": 2 }, { "codigo": "e5f6a7b8", "cantidad": 1 }],
  "p_metodo_pago": null,
  "p_entrega": "retiro",
  "p_direccion": null,
  "p_notas": null,
  "p_origen_mensaje_id": "3EB0A1B2C3D4E5F6"
}
```

- `p_origen_mensaje_id`: usa el **id del mensaje de WhatsApp** (`data.key.id` en Evolution). Hace la llamada **idempotente**:
  si el webhook se repite, devuelve el pedido ya creado (`"duplicado": true`) sin volver a descontar stock.
- `p_telefono`: el remitente (`remoteJid` sin `@s.whatsapp.net`). Se normaliza a solo dígitos (10–15).

**Respuesta correcta** (`HTTP 200`):

```json
{ "ok": true, "duplicado": false, "pedido_id": "…", "negocio": "nueva-victoria", "total_usd": 19.00,
  "tasa_bs": 52.35, "items": [{ "codigo": "a1b2c3d4", "nombre_producto": "Pan canilla", "cantidad": 2, "precio_unitario_usd": 0.50 }] }
```

**Respuesta con error** (también `HTTP 200`; **no se guarda nada**, el stock queda intacto):

```json
{ "ok": false, "error": "stock_insuficiente", "detalle": { "codigo": "a1b2c3d4", "nombre": "Pan canilla", "pedido": 6, "disponible": 5 } }
```

| `error` | Qué pasó | Qué decirle al cliente |
|---|---|---|
| `negocio_no_encontrado` | La instancia no está asociada a ningún local | (interno) revisa la configuración |
| `negocio_pausado` | El local está pausado por falta de pago | «Ahora mismo no estamos tomando pedidos» |
| `slug_no_coincide` | El mensaje era de otro local (o fue manipulado) | Pídele que use el menú de este local |
| `telefono_invalido`, `items_invalidos`, `entrega_invalida` | Datos mal formados | Pídele que vuelva a armar el pedido desde el menú |
| `direccion_requerida` | Domicilio sin dirección | Pídele la dirección |
| `producto_no_encontrado`, `codigo_ambiguo` | El código no existe en este local | El menú cambió: que lo arme de nuevo |
| `producto_no_disponible` | Agotado o de una categoría desactivada | Ofrécele alternativas |
| `stock_insuficiente` | Pidió más de lo que queda (`detalle.disponible`) | «Solo quedan N de X» |

## 5. Cambiar el estado: `agente_cambiar_estado_pedido`

```
POST {SUPABASE_URL}/rest/v1/rpc/agente_cambiar_estado_pedido
{ "p_instancia": "menu-nueva-victoria", "p_pedido": "<uuid>", "p_estado": "pagado", "p_metodo_pago": "zelle" }
```

Estados: `nuevo → confirmado | pagado | cancelado`, `confirmado → pagado | entregado | cancelado`,
`pagado → entregado | cancelado`; **`entregado` y `cancelado` son finales**. **Cancelar devuelve el stock.**
El pedido debe ser del local de esa instancia (`pedido_no_encontrado` si no). Respuesta: `{ "ok": true, "estado": "pagado" }`
o `{ "ok": false, "error": "cambio_no_permitido", "detalle": "…" }`.

> No cambies el estado editando la tabla `pedidos` directamente: se pierde la devolución de stock al cancelar.

**Ventas:** el panel (dashboard, reportes) cuenta como venta los pedidos en `confirmado`, `pagado` y `entregado`.
Un pedido `nuevo` o `cancelado` no suma.

## 6. Stock y disponibilidad

- `stock` vacío = **sin control** (siempre disponible, p. ej. pan que se hornea a demanda). Con un número, cada venta lo descuenta
  y al llegar a 0 el producto pasa a *Agotado* solo; al reponerlo vuelve a estar disponible.
- El **menú público solo muestra `disponible`**, nunca el número, y se actualiza con hasta ~60 s de retraso. **No decidas
  disponibilidad mirando el menú:** `crear_pedido` es la fuente de verdad y ya valida el stock con el registro bloqueado
  (dos clientes pidiendo la última unidad a la vez: solo uno se la lleva).

## 7. Instancias de Evolution

Cada local tiene la suya, con nombre **`menu-{slug}`**, creada por la web al dar de alta el local (super admin) y guardada en
`negocios.evolution_instance_name`. El dueño vincula su WhatsApp escaneando el QR desde su panel → Configuración.
El webhook de cada instancia apunta a n8n; en el evento llega el nombre de la instancia: es el `p_instancia` de arriba.

## 8. Lista de comprobación para el flujo de n8n

- [ ] Pega `docs/n8n/parsear-pedido.js` y rechaza los mensajes con `ok: false` con un texto amable.
- [ ] `p_instancia` sale del webhook, no del mensaje.
- [ ] `p_origen_mensaje_id` = id del mensaje de WhatsApp.
- [ ] Ningún importe del mensaje se usa para cobrar; el total que confirmes sale de la respuesta de `crear_pedido`.
- [ ] Nombre, dirección y notas no llegan al modelo como instrucciones.
- [ ] `service_role` solo en credenciales de n8n.
- [ ] Cambios de estado con `agente_cambiar_estado_pedido`, nunca con `PATCH` a la tabla.
