-- 0010_estado_listo.sql
-- Nuevo estado de pedido «listo»: listo para retirar (o en camino, si es a domicilio). El agente le avisa
-- al cliente en cada cambio de estado (migración 0011), y «listo» es el aviso que más espera el cliente.
--
-- Máquina de estados (la misma para el panel y el agente):
--   nuevo      -> confirmado | pagado | cancelado
--   confirmado -> pagado | listo | entregado | cancelado
--   pagado     -> listo | entregado | cancelado
--   listo      -> pagado | entregado | cancelado     (pagado: quien paga al retirar)
--   entregado, cancelado: finales. Cancelar DEVUELVE el stock.
-- Ventas = confirmado, pagado, listo, entregado.

begin;

alter table public.pedidos drop constraint pedidos_estado_valido;
alter table public.pedidos add constraint pedidos_estado_valido
  check (estado in ('nuevo', 'confirmado', 'pagado', 'listo', 'entregado', 'cancelado'));

create or replace function public._cambiar_estado_pedido(p_pedido uuid, p_estado text, p_metodo_pago text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ped record;
  v_ok  boolean;
  l     record;
begin
  select p.id, p.estado into v_ped from public.pedidos p where p.id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado' using errcode = 'P0002'; end if;

  v_ok := (v_ped.estado = 'nuevo'      and p_estado in ('confirmado', 'pagado', 'cancelado'))
       or (v_ped.estado = 'confirmado' and p_estado in ('pagado', 'listo', 'entregado', 'cancelado'))
       or (v_ped.estado = 'pagado'     and p_estado in ('listo', 'entregado', 'cancelado'))
       or (v_ped.estado = 'listo'      and p_estado in ('pagado', 'entregado', 'cancelado'));
  if not coalesce(v_ok, false) then
    raise exception 'Cambio de estado no permitido: % -> %', v_ped.estado, p_estado using errcode = '22023';
  end if;

  if p_estado = 'cancelado' then
    for l in
      select i.producto_id, sum(i.cantidad)::integer as cantidad
      from public.pedido_items i
      where i.pedido_id = v_ped.id and i.producto_id is not null
      group by i.producto_id order by i.producto_id
    loop
      update public.productos set stock = stock + l.cantidad where id = l.producto_id and stock is not null;
    end loop;
  end if;

  update public.pedidos
     set estado = p_estado,
         metodo_pago = coalesce(nullif(left(btrim(coalesce(p_metodo_pago, '')), 40), ''), metodo_pago)
   where id = v_ped.id;
  return p_estado;
end
$$;

-- Reportes: «listo» cuenta como venta (mismo cuerpo que en 0009, con el estado nuevo).
create or replace function public.ventas_por_periodo(p_negocio uuid, p_desde date, p_hasta date, p_grano text default 'day')
returns table (periodo date, pedidos bigint, total_usd numeric, total_bs numeric)
language sql
stable
set search_path = ''
as $$
  select date_trunc(case when p_grano in ('day', 'week', 'month') then p_grano else 'day' end,
                    p.created_at at time zone 'America/Caracas')::date,
         count(*),
         coalesce(sum(p.total_usd), 0),
         coalesce(sum(p.total_usd * p.tasa_bs), 0)
  from public.pedidos p
  where p.negocio_id = p_negocio
    and p.estado in ('confirmado', 'pagado', 'listo', 'entregado')
    and (p.created_at at time zone 'America/Caracas')::date between p_desde and p_hasta
  group by 1
  order by 1
$$;

create or replace function public.productos_mas_vendidos(p_negocio uuid, p_desde date, p_hasta date, p_limite integer default 10)
returns table (producto_id uuid, nombre text, unidades bigint, total_usd numeric)
language sql
stable
set search_path = ''
as $$
  select i.producto_id,
         max(i.nombre_producto),
         sum(i.cantidad)::bigint,
         coalesce(sum(i.cantidad * i.precio_unitario_usd), 0)
  from public.pedido_items i
  join public.pedidos p on p.id = i.pedido_id
  where p.negocio_id = p_negocio
    and p.estado in ('confirmado', 'pagado', 'listo', 'entregado')
    and (p.created_at at time zone 'America/Caracas')::date between p_desde and p_hasta
  group by i.producto_id, case when i.producto_id is null then i.nombre_producto end
  order by 3 desc, 2
  limit least(greatest(p_limite, 1), 50)
$$;

create or replace function public.clientes_resumen(p_negocio uuid, p_limite integer default 200)
returns table (cliente_id uuid, telefono text, nombre text, pedidos bigint, total_usd numeric,
               primera_compra timestamptz, ultima_compra timestamptz)
language sql
stable
set search_path = ''
as $$
  select c.id, c.telefono, c.nombre,
         count(p.id) filter (where p.estado <> 'cancelado'),
         coalesce(sum(p.total_usd) filter (where p.estado in ('confirmado', 'pagado', 'listo', 'entregado')), 0),
         c.primera_compra, c.ultima_compra
  from public.clientes c
  left join public.pedidos p on p.cliente_id = c.id
  where c.negocio_id = p_negocio
  group by c.id
  order by c.ultima_compra desc
  limit least(greatest(p_limite, 1), 1000)
$$;

-- «create or replace» conserva los permisos, pero se reafirman por si acaso.
revoke all on function public._cambiar_estado_pedido(uuid, text, text) from public, anon, authenticated;
revoke all on function
  public.ventas_por_periodo(uuid, date, date, text),
  public.productos_mas_vendidos(uuid, date, date, integer),
  public.clientes_resumen(uuid, integer)
from public, anon;
grant execute on function
  public.ventas_por_periodo(uuid, date, date, text),
  public.productos_mas_vendidos(uuid, date, date, integer),
  public.clientes_resumen(uuid, integer)
to authenticated;

commit;
