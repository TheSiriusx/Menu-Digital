-- 0008_seguridad_agente.sql
-- Permisos y RLS de lo añadido en 0007. Principios:
--  * el público (anon) NUNCA ve stock, ni pedidos, ni clientes, ni la instancia de Evolution;
--  * un dueño solo ve lo de su local (y solo en las tablas que le corresponden);
--  * las escrituras del agente pasan por funciones (0009), no por INSERT sueltos.

begin;

-- ---------------------------------------------------------------------------
-- productos: el público sigue viendo exactamente las columnas de antes; `stock` queda fuera.
-- Hasta ahora anon tenía SELECT de tabla completa: una columna nueva quedaba visible sola.
-- ---------------------------------------------------------------------------
revoke select on public.productos from anon, authenticated;

grant select (id, negocio_id, categoria_id, nombre, descripcion, precio_usd, disponible, foto_url, orden)
  on public.productos to anon;

-- authenticated lee todas las columnas (stock incluido), pero las filas las limitan las políticas de
-- abajo: cada dueño solo ve las suyas. La lectura pública pasa a ser solo para anon.
grant select on public.productos to authenticated;
grant insert (stock) on public.productos to authenticated;
grant update (stock) on public.productos to authenticated;

drop policy productos_lectura_publica on public.productos;
create policy productos_lectura_publica
  on public.productos for select to anon
  using (
    exists (select 1 from public.negocios n where n.id = productos.negocio_id and n.activo)
    -- los productos de una categoría desactivada tampoco se ven
    and (productos.categoria_id is null
         or exists (select 1 from public.categorias c where c.id = productos.categoria_id and c.activa))
  );

-- ---------------------------------------------------------------------------
-- categorias: el dueño puede activarlas/desactivarlas; el público solo ve las activas.
-- ---------------------------------------------------------------------------
grant insert (activa) on public.categorias to authenticated;
grant update (activa) on public.categorias to authenticated;

drop policy categorias_lectura_publica on public.categorias;
create policy categorias_lectura_publica
  on public.categorias for select to anon
  using (
    activa
    and exists (select 1 from public.negocios n where n.id = categorias.negocio_id and n.activo)
  );

-- ---------------------------------------------------------------------------
-- pedidos, pedido_items, clientes: solo lectura para el dueño de ese local y el super admin.
-- Nadie con sesión puede insertar, editar ni borrar: lo hacen las funciones de 0009.
-- (service_role, que usa el agente, se salta el RLS por diseño de Supabase.)
-- ---------------------------------------------------------------------------
grant select on public.pedidos, public.pedido_items, public.clientes to authenticated;

create policy pedidos_dueno_lee
  on public.pedidos for select to authenticated
  using (negocio_id = (select public.mi_negocio_id()));
create policy pedidos_superadmin_lee
  on public.pedidos for select to authenticated
  using ((select public.es_superadmin()));

create policy pedido_items_dueno_lee
  on public.pedido_items for select to authenticated
  using (negocio_id = (select public.mi_negocio_id()));
create policy pedido_items_superadmin_lee
  on public.pedido_items for select to authenticated
  using ((select public.es_superadmin()));

create policy clientes_dueno_lee
  on public.clientes for select to authenticated
  using (negocio_id = (select public.mi_negocio_id()));
create policy clientes_superadmin_lee
  on public.clientes for select to authenticated
  using ((select public.es_superadmin()));

-- ---------------------------------------------------------------------------
-- negocios.evolution_instance_name: no entra en ningún permiso de columna (ni del público ni de los
-- dueños: la política de lectura de negocios es abierta y filtraría la de todos los locales).
-- Se lee y se fija solo con estas funciones.
-- ---------------------------------------------------------------------------
create or replace function public.mi_instancia_evolution()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select n.evolution_instance_name
  from public.negocios n
  where n.id = (select public.mi_negocio_id())
$$;

create or replace function public.instancia_evolution_de(p_negocio uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare nombre text;
begin
  if not (select public.es_superadmin()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  select evolution_instance_name into nombre from public.negocios where id = p_negocio;
  return nombre;
end
$$;

create or replace function public.fijar_instancia_evolution(p_negocio uuid, p_nombre text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.es_superadmin()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  -- El formato lo valida la restricción de la tabla; la unicidad, el índice único.
  update public.negocios set evolution_instance_name = p_nombre where id = p_negocio;
  if not found then raise exception 'Local no encontrado' using errcode = 'P0002'; end if;
end
$$;

-- listar_negocios ahora dice si cada local ya tiene instancia de WhatsApp (para el aviso "pendiente").
drop function public.listar_negocios();
create function public.listar_negocios()
returns table (
  id uuid, slug text, nombre text, tipo text, plan text, activo boolean,
  tasa_bs numeric, telefono_whatsapp text, created_at timestamptz,
  productos bigint, duenos text[], instancia text
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
                     where pf.negocio_id = n.id and pf.rol = 'dueno'), '{}'),
           n.evolution_instance_name
    from public.negocios n
    order by n.created_at desc;
end
$$;

revoke all on function
  public.mi_instancia_evolution(), public.instancia_evolution_de(uuid),
  public.fijar_instancia_evolution(uuid, text), public.listar_negocios()
from public, anon;
grant execute on function
  public.mi_instancia_evolution(), public.instancia_evolution_de(uuid),
  public.fijar_instancia_evolution(uuid, text), public.listar_negocios()
to authenticated;

commit;
