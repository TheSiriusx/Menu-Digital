-- 0002_rls.sql
-- Lectura pública del menú con la clave anon. Nadie escribe con la clave pública.
-- Se ejecuta una sola vez, pegándolo en Supabase -> SQL Editor -> Run.

begin;

-- ---------------------------------------------------------------------------
-- Defensa en profundidad: la clave pública (rol anon) parte de cero permisos y
-- solo recibe lectura de lo que el menú público necesita, antes de que RLS actúe.
-- perfiles queda sin ningún permiso para anon.
-- ---------------------------------------------------------------------------
revoke all on public.negocios, public.categorias, public.productos, public.perfiles from anon;

grant select on public.categorias, public.productos to anon;

-- negocios: se puede leer aunque esté pausado (para mostrar "menú no disponible"),
-- pero solo las columnas que necesita el menú público. `plan` y `created_at`
-- (datos comerciales) quedan ocultos para la clave pública.
-- Consecuencia: con la clave pública hay que pedir columnas, no usar select('*').
grant select (id, slug, nombre, tipo, logo_url, color, telefono_whatsapp, horario, tasa_bs, activo)
  on public.negocios to anon;

create policy negocios_lectura_publica
  on public.negocios for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- categorias y productos: solo se leen si su negocio está activo.
-- Un local pausado no filtra su catálogo aunque alguien consulte la API directo.
-- ---------------------------------------------------------------------------
create policy categorias_lectura_publica
  on public.categorias for select
  to anon, authenticated
  using (exists (
    select 1 from public.negocios n
    where n.id = categorias.negocio_id and n.activo
  ));

create policy productos_lectura_publica
  on public.productos for select
  to anon, authenticated
  using (exists (
    select 1 from public.negocios n
    where n.id = productos.negocio_id and n.activo
  ));

-- perfiles: sin políticas a propósito. Las del dueño llegan en la Fase 3.

commit;
