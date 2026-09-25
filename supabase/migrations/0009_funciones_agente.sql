-- 0009_funciones_agente.sql
-- Funciones del agente y del panel:
--   crear_pedido, agente_cambiar_estado_pedido (solo service_role: el agente de WhatsApp)
--   cambiar_estado_pedido (dueño o super admin)
--   ventas_por_periodo, productos_mas_vendidos, clientes_resumen (reportes; el RLS del que llama aplica solo)
--
-- Ventas = pedidos en estado confirmado, pagado o entregado. Los días se cuentan en hora de Venezuela.

begin;

-- ---------------------------------------------------------------------------
-- crear_pedido: registra una venta de forma ATÓMICA.
--   * El local sale de la instancia de Evolution por la que llegó el mensaje (p_instancia), que es la
--     fuente de verdad; el slug del mensaje solo se contrasta. Un cliente que edite el texto del
--     mensaje no puede cargar el pedido a otro local.
--   * Los productos se identifican por el código corto (8 primeros caracteres de su id).
--   * Precios y total se calculan AQUÍ desde la base de datos: nada del mensaje se acepta como precio.
--   * El stock se descuenta con la fila bloqueada: dos clientes pidiendo la última unidad a la vez,
--     solo uno se la lleva. Si algo falla, no queda ningún cambio a medias.
--   * Es idempotente: el mismo p_origen_mensaje_id devuelve el pedido ya creado.
-- Devuelve siempre un jsonb: {"ok": true, ...} o {"ok": false, "error": "<codigo>", "detalle": {...}}.
-- ---------------------------------------------------------------------------
create or replace function public.crear_pedido(
  p_instancia         text,
  p_slug              text,
  p_telefono          text,
  p_nombre            text,
  p_items             jsonb,
  p_metodo_pago       text default null,
  p_entrega           text default 'retiro',
  p_direccion         text default null,
  p_notas             text default null,
  p_origen_mensaje_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_neg       record;
  v_prod      record;
  v_item      record;
  v_existente record;
  v_tel       text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  v_nombre    text := nullif(left(btrim(coalesce(p_nombre, '')), 80), '');
  v_dir       text := nullif(left(btrim(coalesce(p_direccion, '')), 300), '');
  v_notas     text := nullif(left(btrim(coalesce(p_notas, '')), 500), '');
  v_pago      text := nullif(left(btrim(coalesce(p_metodo_pago, '')), 40), '');
  v_lineas    jsonb := '[]'::jsonb;
  v_total     numeric(12,2) := 0;
  v_cliente   uuid;
  v_pedido    uuid;
  v_cuantos   integer;
  v_cat_activa boolean;
  v_detalle   text;
  e           jsonb;
begin
  -- 1) El local, por su instancia de WhatsApp.
  select n.id, n.slug, n.activo, n.tasa_bs into v_neg
  from public.negocios n where n.evolution_instance_name = p_instancia;
  if not found then return jsonb_build_object('ok', false, 'error', 'negocio_no_encontrado'); end if;
  if not v_neg.activo then return jsonb_build_object('ok', false, 'error', 'negocio_pausado'); end if;
  if p_slug is distinct from v_neg.slug then
    return jsonb_build_object('ok', false, 'error', 'slug_no_coincide', 'detalle', jsonb_build_object('esperado', v_neg.slug));
  end if;

  -- 2) Validaciones baratas, antes de tocar nada.
  if v_tel !~ '^[0-9]{10,15}$' then return jsonb_build_object('ok', false, 'error', 'telefono_invalido'); end if;
  if p_entrega not in ('retiro', 'domicilio') then return jsonb_build_object('ok', false, 'error', 'entrega_invalida'); end if;
  if p_entrega = 'domicilio' and v_dir is null then return jsonb_build_object('ok', false, 'error', 'direccion_requerida'); end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    return jsonb_build_object('ok', false, 'error', 'items_invalidos');
  end if;
  for e in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(e) <> 'object'
       or coalesce(e->>'codigo', '') !~ '^[0-9a-f]{8}$'
       or coalesce(e->>'cantidad', '') !~ '^[1-9][0-9]{0,2}$' then
      return jsonb_build_object('ok', false, 'error', 'items_invalidos', 'detalle', jsonb_build_object('item', e));
    end if;
  end loop;

  -- 3) Idempotencia: el mismo mensaje no crea otro pedido.
  if p_origen_mensaje_id is not null then
    select p.id, p.total_usd into v_existente
    from public.pedidos p where p.negocio_id = v_neg.id and p.origen_mensaje_id = p_origen_mensaje_id;
    if found then
      return jsonb_build_object('ok', true, 'duplicado', true, 'pedido_id', v_existente.id, 'total_usd', v_existente.total_usd);
    end if;
  end if;

  begin
    -- 4) Productos: se agrupan por código (sumando cantidades) y se recorren en orden fijo para no
    --    provocar bloqueos cruzados entre pedidos simultáneos.
    for v_item in
      select x.codigo, sum(x.cantidad)::integer as cantidad
      from (select e2->>'codigo' as codigo, (e2->>'cantidad')::integer as cantidad
            from jsonb_array_elements(p_items) e2) x
      group by x.codigo order by x.codigo
    loop
      if v_item.cantidad > 999 then
        raise exception 'items_invalidos' using detail = jsonb_build_object('codigo', v_item.codigo)::text;
      end if;

      select count(*) into v_cuantos from public.productos p
      where p.negocio_id = v_neg.id and left(p.id::text, 8) = v_item.codigo;
      if v_cuantos = 0 then
        raise exception 'producto_no_encontrado' using detail = jsonb_build_object('codigo', v_item.codigo)::text;
      elsif v_cuantos > 1 then
        raise exception 'codigo_ambiguo' using detail = jsonb_build_object('codigo', v_item.codigo)::text;
      end if;

      select p.id, p.nombre, p.precio_usd, p.disponible, p.stock, p.categoria_id into v_prod
      from public.productos p
      where p.negocio_id = v_neg.id and left(p.id::text, 8) = v_item.codigo
      for update of p;

      v_cat_activa := true;
      if v_prod.categoria_id is not null then
        select c.activa into v_cat_activa from public.categorias c where c.id = v_prod.categoria_id;
      end if;

      if not v_prod.disponible or not v_cat_activa then
        raise exception 'producto_no_disponible'
          using detail = jsonb_build_object('codigo', v_item.codigo, 'nombre', v_prod.nombre)::text;
      end if;
      if v_prod.stock is not null then
        if v_prod.stock < v_item.cantidad then
          raise exception 'stock_insuficiente'
            using detail = jsonb_build_object('codigo', v_item.codigo, 'nombre', v_prod.nombre,
                                              'pedido', v_item.cantidad, 'disponible', v_prod.stock)::text;
        end if;
        update public.productos set stock = stock - v_item.cantidad where id = v_prod.id;
      end if;

      v_total := v_total + round(v_prod.precio_usd * v_item.cantidad, 2);
      v_lineas := v_lineas || jsonb_build_array(jsonb_build_object(
        'producto_id', v_prod.id, 'codigo', v_item.codigo, 'nombre_producto', v_prod.nombre,
        'cantidad', v_item.cantidad, 'precio_unitario_usd', v_prod.precio_usd));
    end loop;

    -- 5) Cliente (uno por teléfono y local) y pedido con sus líneas.
    insert into public.clientes (negocio_id, telefono, nombre)
    values (v_neg.id, v_tel, v_nombre)
    on conflict (negocio_id, telefono)
    do update set ultima_compra = now(), nombre = coalesce(excluded.nombre, public.clientes.nombre)
    returning id into v_cliente;

    insert into public.pedidos (negocio_id, cliente_id, cliente_telefono, cliente_nombre, total_usd, tasa_bs,
                                metodo_pago, entrega, direccion, notas, origen_mensaje_id)
    values (v_neg.id, v_cliente, v_tel, v_nombre, v_total, v_neg.tasa_bs, v_pago, p_entrega, v_dir, v_notas, p_origen_mensaje_id)
    returning id into v_pedido;

    insert into public.pedido_items (pedido_id, negocio_id, producto_id, nombre_producto, cantidad, precio_unitario_usd)
    select v_pedido, v_neg.id, l.producto_id, l.nombre_producto, l.cantidad, l.precio_unitario_usd
    from jsonb_to_recordset(v_lineas) as l(producto_id uuid, nombre_producto text, cantidad integer, precio_unitario_usd numeric);

    return jsonb_build_object('ok', true, 'duplicado', false, 'pedido_id', v_pedido, 'negocio', v_neg.slug,
                              'total_usd', v_total, 'tasa_bs', v_neg.tasa_bs, 'items', v_lineas);
  exception
    when raise_exception then
      -- Este bloque ya deshizo todo lo hecho dentro de él (stock incluido).
      get stacked diagnostics v_detalle = pg_exception_detail;
      return jsonb_build_object('ok', false, 'error', sqlerrm,
                                'detalle', coalesce(nullif(v_detalle, '')::jsonb, '{}'::jsonb));
    when unique_violation then
      -- Dos entregas simultáneas del mismo mensaje: ganó la otra.
      select p.id, p.total_usd into v_existente
      from public.pedidos p where p.negocio_id = v_neg.id and p.origen_mensaje_id = p_origen_mensaje_id;
      if found then
        return jsonb_build_object('ok', true, 'duplicado', true, 'pedido_id', v_existente.id, 'total_usd', v_existente.total_usd);
      end if;
      raise;
  end;
end
$$;

-- ---------------------------------------------------------------------------
-- Cambio de estado de un pedido. Máquina de estados única, con tres puertas de entrada:
--   _cambiar_estado_pedido           interna, sin permisos de nadie (solo la llaman las dos de abajo)
--   cambiar_estado_pedido            el dueño (con su local activo) o el super admin desde el panel
--   agente_cambiar_estado_pedido     el agente (service_role), acotado al local de su instancia
-- nuevo -> confirmado | pagado | cancelado; confirmado -> pagado | entregado | cancelado;
-- pagado -> entregado | cancelado; entregado y cancelado son finales. Cancelar DEVUELVE el stock.
-- ---------------------------------------------------------------------------
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
       or (v_ped.estado = 'confirmado' and p_estado in ('pagado', 'entregado', 'cancelado'))
       or (v_ped.estado = 'pagado'     and p_estado in ('entregado', 'cancelado'));
  if not v_ok then
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

create or replace function public.cambiar_estado_pedido(p_pedido uuid, p_estado text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_negocio uuid;
begin
  select p.negocio_id into v_negocio from public.pedidos p where p.id = p_pedido;
  if v_negocio is null then raise exception 'Pedido no encontrado' using errcode = 'P0002'; end if;

  -- OJO con NULL: sin local activo (local pausado o cuenta sin perfil) mi_negocio_activo_id() es NULL,
  -- la comparación da NULL y "if not NULL" NO dispara el error. Por eso se fuerza a false con coalesce.
  if not (coalesce((select public.es_superadmin()), false)
          or coalesce(v_negocio = (select public.mi_negocio_activo_id()), false)) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  return public._cambiar_estado_pedido(p_pedido, p_estado);
end
$$;

create or replace function public.agente_cambiar_estado_pedido(
  p_instancia text, p_pedido uuid, p_estado text, p_metodo_pago text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_negocio uuid; v_detalle text;
begin
  select n.id into v_negocio from public.negocios n where n.evolution_instance_name = p_instancia;
  if v_negocio is null then return jsonb_build_object('ok', false, 'error', 'negocio_no_encontrado'); end if;

  -- El pedido tiene que ser del local de esa instancia: el agente de un local no toca los de otro.
  if not exists (select 1 from public.pedidos p where p.id = p_pedido and p.negocio_id = v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'pedido_no_encontrado');
  end if;

  return jsonb_build_object('ok', true, 'estado', public._cambiar_estado_pedido(p_pedido, p_estado, p_metodo_pago));
exception when others then
  get stacked diagnostics v_detalle = message_text;
  return jsonb_build_object('ok', false, 'error', 'cambio_no_permitido', 'detalle', v_detalle);
end
$$;

-- ---------------------------------------------------------------------------
-- Reportes. Sin security definer: se ejecutan con los permisos de quien llama, así que el RLS de
-- pedidos hace que un dueño solo pueda sumar lo suyo aunque pase el id de otro local.
-- ---------------------------------------------------------------------------
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
    and p.estado in ('confirmado', 'pagado', 'entregado')
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
    and p.estado in ('confirmado', 'pagado', 'entregado')
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
         coalesce(sum(p.total_usd) filter (where p.estado in ('confirmado', 'pagado', 'entregado')), 0),
         c.primera_compra, c.ultima_compra
  from public.clientes c
  left join public.pedidos p on p.cliente_id = c.id
  where c.negocio_id = p_negocio
  group by c.id
  order by c.ultima_compra desc
  limit least(greatest(p_limite, 1), 1000)
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución.
-- ---------------------------------------------------------------------------
revoke all on function
  public.crear_pedido(text, text, text, text, jsonb, text, text, text, text, text),
  public._cambiar_estado_pedido(uuid, text, text),
  public.agente_cambiar_estado_pedido(text, uuid, text, text),
  public.cambiar_estado_pedido(uuid, text),
  public.ventas_por_periodo(uuid, date, date, text),
  public.productos_mas_vendidos(uuid, date, date, integer),
  public.clientes_resumen(uuid, integer)
from public, anon, authenticated;

-- El agente (service_role) es el único que crea pedidos.
grant execute on function public.crear_pedido(text, text, text, text, jsonb, text, text, text, text, text) to service_role;
grant execute on function public.agente_cambiar_estado_pedido(text, uuid, text, text) to service_role;

grant execute on function
  public.cambiar_estado_pedido(uuid, text),
  public.ventas_por_periodo(uuid, date, date, text),
  public.productos_mas_vendidos(uuid, date, date, integer),
  public.clientes_resumen(uuid, integer)
to authenticated;

commit;
