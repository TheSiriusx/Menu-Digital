# Pídelo

**Pídelo** (by Starck Labs) es una plataforma para que cada negocio (panaderías primero; también restaurantes,
charcuterías, etc.) tenga su menú en línea con enlace propio y QR, reciba pedidos por WhatsApp y lo administre
desde un panel sin depender de nadie. Pensada para Venezuela: precios en dólares y su equivalente en bolívares a
la tasa del día.

- **Menú público:** `{NEXT_PUBLIC_BASE_URL}/{slug}`. Carrito, y el pedido sale como mensaje de WhatsApp al local.
- **Panel del dueño** (`/admin`): dashboard, menú (precios, stock, fotos), pedidos, clientes y configuración.
- **Super admin** (`/superadmin`): alta y pausa de locales, con verificación en dos pasos.
- **Asistente de WhatsApp** (`agente/`): toma pedidos, avisa cambios de estado y pasa a una persona lo delicado.
  Ver [`agente/LEEME.md`](agente/LEEME.md) y [`docs/agente-whatsapp.md`](docs/agente-whatsapp.md).

## Stack

Next.js 16 (App Router) · Supabase (Postgres con RLS, Auth, Storage) · Tailwind CSS 4 · Vercel.
La app web no usa la clave `service_role`: la seguridad está en la base de datos (RLS, permisos por columna y
funciones `security definer`).

## Variables de entorno

Copia `.env.example` a `.env.local`. En producción van en Vercel → Settings → Environment Variables.

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Conexión a Supabase (solo la clave pública) |
| `NEXT_PUBLIC_BASE_URL` | Dirección pública de Pídelo, p. ej. `https://pidelo.starcklabs.com`. De aquí salen el QR, los enlaces y los metadatos (og:url); ninguna URL del sitio está escrita en el código. Si falta, se usa la de la petición. Al cambiarla hay que redesplegar. |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` | WhatsApp (Evolution API). Solo servidor |
| `AGENTE_WEBHOOK_URL`, `AGENTE_WEBHOOK_SECRET` | Hacia dónde manda Evolution los mensajes (el agente) y su secreto |

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npx tsc --noEmit && npm run lint
```

Las migraciones están en `supabase/migrations/` (se aplican en orden desde el SQL Editor de Supabase) y la
auditoría de seguridad en `supabase/auditoria.sql`. Las pruebas de navegador y de base de datos, con su modo de
uso, están en [`pruebas/LEEME.md`](pruebas/LEEME.md).

## Despliegue

Vercel despliega solo al hacer push a `main`. Para usar el dominio propio: agregarlo en Vercel → Domains, apuntar el
DNS, poner `NEXT_PUBLIC_BASE_URL` con ese dominio (también en `agente/.env`) y redesplegar.
