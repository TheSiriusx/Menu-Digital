# Pruebas

Herramientas para probar la aplicación contra la base real (Supabase) y un navegador real (Firefox headless).
**Tocan datos reales**: siempre terminar con `python3 pruebas/limpiar.py`.

Requisitos: `.env.local` con `SUPABASE_ACCESS_TOKEN`, `npm install` dentro de `pruebas/e2e`, servidor en `http://localhost:3100`
(`npx next build && npx next start -p 3100`) y Firefox (`sh pruebas/firefox.sh`, solo admite una sesión por arranque).

| Paso | Comando |
|---|---|
| Usuarios temporales (super admin con TOTP, dueños) → `pruebas/e2e4.env` | `python3 pruebas/preparar.py` |
| Pedidos y clientes de ejemplo (Entrega B) | `python3 pruebas/sembrar_b.py` |
| Baterías de navegador (log en `pruebas/logs/`) | `sh pruebas/regresion.sh panelb csp estilos …` |
| Permisos de base de datos (en transacción que se revierte) | pegar `pruebas/sql/aislamiento7.sql` en el SQL Editor |
| Auditorías | `node scripts/auditoria-codigo.mjs` y `supabase/auditoria.sql` |
| Dejar todo como estaba | `python3 pruebas/limpiar.py` |

Baterías: `panelb` (cinco pestañas), `panel` (panel del dueño, usa `pruebas/e2e.env`), `fotos`, `csp`, `mfa`, `superadmin`, `whatsapp`
(con `scripts/evolution-simulada.mjs`), `estilos`, `prueba` (carrito público).
