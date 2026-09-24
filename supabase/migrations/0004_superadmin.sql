-- 0004_superadmin.sql
-- Super admin (Starck Labs) y solo lectura por impago. Se ejecuta una sola vez.
--
-- Las operaciones sensibles (crear locales, pausar, planes, vincular dueños) son funciones
-- security definer que comprueban es_superadmin() por dentro. NO se amplían los permisos por
-- columna del rol authenticated: si se le diera UPDATE(activo, plan), cualquier dueño podría
-- reactivarse o cambiarse el plan. Las funciones son la única puerta.

begin;

-- ---------------------------------------------------------------------------
-- ¿El usuario autenticado es super admin? (security definer: lee perfiles sin depender de sus políticas)
-- ---------------------------------------------------------------------------
create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles where id = (select auth.uid()) and rol = 'superadmin'
  )
$$;

revoke all on function public.es_superadmin() from public, anon;
grant execute on function public.es_superadmin() to authenticated;

-- ---------------------------------------------------------------------------
-- Solo lectura por impago: las políticas de escritura del dueño exigen negocio activo.
-- El dueño sigue pudiendo LEER todo (sus políticas de select no cambian).
-- ---------------------------------------------------------------------------
create or replace function public.mi_negocio_activo_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.negocio_id
  from public.perfiles p
  join public.negocios n on n.id = p.negocio_id
  where p.id = (select auth.uid()) and n.activo
$$;

revoke all on function public.mi_negocio_activo_id() from public, anon;
grant execute on function public.mi_negocio_activo_id() to authenticated;

drop policy negocios_dueno_actualiza on public.negocios;
create policy negocios_dueno_actualiza
  on public.negocios for update to authenticated
  using (id = (select public.mi_negocio_activo_id()))
  with check (id = (select public.mi_negocio_activo_id()));

drop policy categorias_dueno_inserta on public.categorias;
drop policy categorias_dueno_actualiza on public.categorias;
drop policy categorias_dueno_borra on public.categorias;
create policy categorias_dueno_inserta
  on public.categorias for insert to authenticated
  with check (negocio_id = (select public.mi_negocio_activo_id()));
create policy categorias_dueno_actualiza
  on public.categorias for update to authenticated
  using (negocio_id = (select public.mi_negocio_activo_id()))
  with check (negocio_id = (select public.mi_negocio_activo_id()));
create policy categorias_dueno_borra
  on public.categorias for delete to authenticated
  using (negocio_id = (select public.mi_negocio_activo_id()));

drop policy productos_dueno_inserta on public.productos;
drop policy productos_dueno_actualiza on public.productos;
drop policy productos_dueno_borra on public.productos;
create policy productos_dueno_inserta
  on public.productos for insert to authenticated
  with check (negocio_id = (select public.mi_negocio_activo_id()));
create policy productos_dueno_actualiza
  on public.productos for update to authenticated
  using (negocio_id = (select public.mi_negocio_activo_id()))
  with check (negocio_id = (select public.mi_negocio_activo_id()));
create policy productos_dueno_borra
  on public.productos for delete to authenticated
  using (negocio_id = (select public.mi_negocio_activo_id()));

-- ---------------------------------------------------------------------------
-- Políticas del super admin: catálogo y datos del local de CUALQUIER negocio (aunque esté
-- pausado). Los permisos por columna siguen siendo los mismos que los del dueño.
-- ---------------------------------------------------------------------------
create policy negocios_superadmin_actualiza
  on public.negocios for update to authenticated
  using ((select public.es_superadmin()))
  with check ((select public.es_superadmin()));

create policy categorias_superadmin_lee
  on public.categorias for select to authenticated using ((select public.es_superadmin()));
create policy categorias_superadmin_inserta
  on public.categorias for insert to authenticated with check ((select public.es_superadmin()));
create policy categorias_superadmin_actualiza
  on public.categorias for update to authenticated
  using ((select public.es_superadmin())) with check ((select public.es_superadmin()));
create policy categorias_superadmin_borra
  on public.categorias for delete to authenticated using ((select public.es_superadmin()));

create policy productos_superadmin_lee
  on public.productos for select to authenticated using ((select public.es_superadmin()));
create policy productos_superadmin_inserta
  on public.productos for insert to authenticated with check ((select public.es_superadmin()));
create policy productos_superadmin_actualiza
  on public.productos for update to authenticated
  using ((select public.es_superadmin())) with check ((select public.es_superadmin()));
create policy productos_superadmin_borra
  on public.productos for delete to authenticated using ((select public.es_superadmin()));

-- ---------------------------------------------------------------------------
-- Funciones del super admin. Todas: security definer, search_path vacío, comprobación de rol
-- al principio, y solo ejecutables por usuarios autenticados.
-- ---------------------------------------------------------------------------
create or replace function public.listar_negocios()
returns table (
  id uuid, slug text, nombre text, tipo text, plan text, activo boolean,
  tasa_bs numeric, telefono_whatsapp text, created_at timestamptz,
  productos bigint, duenos text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.es_superadmin()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  return query
    select n.id, n.slug, n.nombre, n.tipo, n.plan, n.activo, n.tasa_bs, n.telefono_whatsapp, n.created_at,
           (select count(*) from public.productos p where p.negocio_id = n.id),
           coalesce((select array_agg(u.email::text order by u.email)
                     from public.perfiles pf join auth.users u on u.id = pf.id
                     where pf.negocio_id = n.id and pf.rol = 'dueno'), '{}')
    from public.negocios n
    order by n.created_at desc;
end
$$;

create or replace function public.crear_negocio(p_slug text, p_nombre text, p_tipo text, p_plan text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare nuevo uuid;
begin
  if not (select public.es_superadmin()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_plan not in ('basico', 'pro') then
    raise exception 'Plan no válido' using errcode = '22023';
  end if;
  if p_tipo is null or char_length(p_tipo) not between 1 and 40 then
    raise exception 'Tipo no válido' using errcode = '22023';
  end if;
  -- El formato y los slugs reservados los validan las restricciones de la tabla.
  insert into public.negocios (slug, nombre, tipo, plan)
  values (p_slug, p_nombre, p_tipo, p_plan)
  returning id into nuevo;
  return nuevo;
end
$$;

create or replace function public.cambiar_estado_negocio(p_negocio uuid, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.es_superadmin()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  update public.negocios set activo = p_activo where id = p_negocio;
  if not found then raise exception 'Local no encontrado' using errcode = 'P0002'; end if;
end
$$;

create or replace function public.cambiar_plan_negocio(p_negocio uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.es_superadmin()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_plan not in ('basico', 'pro') then
    raise exception 'Plan no válido' using errcode = '22023';
  end if;
  update public.negocios set plan = p_plan where id = p_negocio;
  if not found then raise exception 'Local no encontrado' using errcode = 'P0002'; end if;
end
$$;

-- Vincula una cuenta YA creada en Supabase Auth como dueño de un local.
-- No permite tocar a un super admin, y una cuenta solo puede ser dueña de un local.
create or replace function public.vincular_dueno(p_correo text, p_negocio uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare usuario uuid; rol_actual text;
begin
  if not (select public.es_superadmin()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.negocios where id = p_negocio) then
    raise exception 'Local no encontrado' using errcode = 'P0002';
  end if;
  select id into usuario from auth.users where lower(email) = lower(trim(p_correo));
  if usuario is null then
    raise exception 'No existe una cuenta con ese correo. Créala primero en Supabase.' using errcode = 'P0002';
  end if;
  select rol into rol_actual from public.perfiles where id = usuario;
  if rol_actual = 'superadmin' then
    raise exception 'Esa cuenta es de super admin y no puede ser dueña de un local.' using errcode = '22023';
  end if;
  insert into public.perfiles (id, negocio_id, rol) values (usuario, p_negocio, 'dueno')
  on conflict (id) do update set negocio_id = excluded.negocio_id;
end
$$;

create or replace function public.quitar_dueno(p_correo text, p_negocio uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.es_superadmin()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  delete from public.perfiles pf
  using auth.users u
  where u.id = pf.id and lower(u.email) = lower(trim(p_correo))
    and pf.negocio_id = p_negocio and pf.rol = 'dueno';
end
$$;

revoke all on function
  public.listar_negocios(), public.crear_negocio(text, text, text, text),
  public.cambiar_estado_negocio(uuid, boolean), public.cambiar_plan_negocio(uuid, text),
  public.vincular_dueno(text, uuid), public.quitar_dueno(text, uuid)
from public, anon;
grant execute on function
  public.listar_negocios(), public.crear_negocio(text, text, text, text),
  public.cambiar_estado_negocio(uuid, boolean), public.cambiar_plan_negocio(uuid, text),
  public.vincular_dueno(text, uuid), public.quitar_dueno(text, uuid)
to authenticated;

commit;
