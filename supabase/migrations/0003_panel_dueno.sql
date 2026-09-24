-- 0003_panel_dueno.sql
-- Permisos del dueño (rol authenticated) sobre SU negocio. Se ejecuta una sola vez.
-- Principio: el dueño solo puede tocar filas de su negocio y solo las columnas que le
-- corresponden. activo, plan, slug y tipo son del super admin (Fase 4).

begin;

-- ---------------------------------------------------------------------------
-- Negocio del usuario autenticado. security definer para leer perfiles sin
-- depender de sus políticas; search_path vacío para que nadie pueda suplantar objetos.
-- ---------------------------------------------------------------------------
create or replace function public.mi_negocio_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select negocio_id from public.perfiles where id = (select auth.uid())
$$;

revoke all on function public.mi_negocio_id() from public, anon;
grant execute on function public.mi_negocio_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios: se parte de cero y se concede solo lo necesario.
-- ---------------------------------------------------------------------------
revoke all on public.negocios, public.categorias, public.productos, public.perfiles from authenticated;

-- negocios: lee lo mismo que el público (sin plan ni created_at); modifica solo sus ajustes.
grant select (id, slug, nombre, tipo, logo_url, color, telefono_whatsapp, horario, tasa_bs, activo)
  on public.negocios to authenticated;
grant update (nombre, color, telefono_whatsapp, horario, tasa_bs)
  on public.negocios to authenticated;

-- categorias y productos: crea, edita y borra lo suyo. Nunca puede cambiar negocio_id de
-- una fila existente (no está en el update). foto_url llega en la Fase 5.
grant select, delete on public.categorias, public.productos to authenticated;
grant insert (negocio_id, nombre, orden) on public.categorias to authenticated;
grant update (nombre, orden) on public.categorias to authenticated;
grant insert (negocio_id, categoria_id, nombre, descripcion, precio_usd, disponible, orden)
  on public.productos to authenticated;
grant update (categoria_id, nombre, descripcion, precio_usd, disponible, orden)
  on public.productos to authenticated;

-- perfiles: solo puede leer el suyo.
grant select on public.perfiles to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas RLS (se suman a las de lectura pública de 0002).
-- (select ...) hace que Postgres evalúe la función una sola vez por consulta.
-- ---------------------------------------------------------------------------
create policy perfiles_lee_propio
  on public.perfiles for select to authenticated
  using (id = (select auth.uid()));

create policy negocios_dueno_actualiza
  on public.negocios for update to authenticated
  using (id = (select public.mi_negocio_id()))
  with check (id = (select public.mi_negocio_id()));

-- El dueño ve siempre su catálogo completo, aunque el negocio esté pausado.
create policy categorias_dueno_lee
  on public.categorias for select to authenticated
  using (negocio_id = (select public.mi_negocio_id()));
create policy categorias_dueno_inserta
  on public.categorias for insert to authenticated
  with check (negocio_id = (select public.mi_negocio_id()));
create policy categorias_dueno_actualiza
  on public.categorias for update to authenticated
  using (negocio_id = (select public.mi_negocio_id()))
  with check (negocio_id = (select public.mi_negocio_id()));
create policy categorias_dueno_borra
  on public.categorias for delete to authenticated
  using (negocio_id = (select public.mi_negocio_id()));

create policy productos_dueno_lee
  on public.productos for select to authenticated
  using (negocio_id = (select public.mi_negocio_id()));
create policy productos_dueno_inserta
  on public.productos for insert to authenticated
  with check (negocio_id = (select public.mi_negocio_id()));
create policy productos_dueno_actualiza
  on public.productos for update to authenticated
  using (negocio_id = (select public.mi_negocio_id()))
  with check (negocio_id = (select public.mi_negocio_id()));
create policy productos_dueno_borra
  on public.productos for delete to authenticated
  using (negocio_id = (select public.mi_negocio_id()));

-- ---------------------------------------------------------------------------
-- Límites en la propia base de datos (defensa en profundidad: valen aunque alguien
-- salte la validación de la app y hable directo con la API).
-- ---------------------------------------------------------------------------
alter table public.negocios
  add constraint negocios_nombre_largo check (char_length(nombre) between 1 and 80),
  add constraint negocios_horario_largo check (horario is null or char_length(horario) <= 200),
  add constraint negocios_telefono_largo check (telefono_whatsapp is null or char_length(telefono_whatsapp) <= 25),
  add constraint negocios_tasa_maxima check (tasa_bs < 1000000);

alter table public.categorias
  add constraint categorias_nombre_largo check (char_length(nombre) between 1 and 60);

alter table public.productos
  add constraint productos_nombre_largo check (char_length(nombre) between 1 and 120),
  add constraint productos_descripcion_larga check (descripcion is null or char_length(descripcion) <= 500),
  add constraint productos_precio_maximo check (precio_usd <= 100000);

commit;
