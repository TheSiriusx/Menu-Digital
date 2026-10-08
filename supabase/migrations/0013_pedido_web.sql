-- 0013_pedido_web.sql
-- Código corto del pedido del menú. Antes el mensaje de WhatsApp terminaba con un bloque largo
-- ([[PEDIDO v1|negocio=…|items=a1b2c3d4x2,…|total=…]]) que el cliente veía y podía romper sin querer.
-- Ahora, al pulsar «Enviar pedido por WhatsApp», el menú guarda el carrito aquí y el mensaje termina con
-- «Código de tu pedido: P-4F7K2Q». El agente lo busca con ese código y sigue igual que antes
-- (crear_pedido recalcula precios; su idempotencia por origen «web-CÓDIGO» evita pedidos repetidos).
--
-- Seguridad: guardar_pedido_web es la ÚNICA función security definer que el público puede ejecutar
-- (el cliente del menú no inicia sesión). Por eso valida todo y tiene topes: productos del local,
-- disponibles y de categorías visibles; 1–50 líneas; 1–99 unidades; límites por minuto y por día;
-- y los códigos caducan a las 24 h (se borran a los 2 días). La tabla no la lee ni escribe nadie más.

begin;

create table public.pedidos_web (
  codigo      text        primary key check (codigo ~ '^[2-9A-HJKMNP-Z]{6}$'),
  negocio_id  uuid        not null references public.negocios (id) on delete cascade,
  items       jsonb       not null,   -- [{"codigo": "a1b2c3d4", "cantidad": 2}, …]: lo que acepta crear_pedido
  entrega     text        not null check (entrega in ('retiro', 'domicilio')),
  total_usd   numeric(12, 2) not null,  -- informativo: crear_pedido vuelve a calcular con los precios del momento
  tasa_bs     numeric(14, 4) not null,
  creado_en   timestamptz not null default now()
);
create index pedidos_web_negocio_creado on public.pedidos_web (negocio_id, creado_en);
create index pedidos_web_creado on public.pedidos_web (creado_en);

alter table public.pedidos_web enable row level security;  -- sin políticas: nadie entra directo
revoke all on public.pedidos_web from anon, authenticated;

-- ---------------------------------------------------------------------------
-- El menú (público) guarda el carrito y recibe el código. p_items: [{"producto": "<uuid>", "cantidad": n}, …]
-- ---------------------------------------------------------------------------
create or replace function public.guardar_pedido_web(p_negocio text, p_items jsonb, p_entrega text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';   -- sin 0/O, 1/I/L: se dicta sin confusiones
  v_neg     record;
  v_lineas  int;
  v_validas int;
  v_total   numeric;
  v_items   jsonb;
  v_codigo  text;
  v_bytes   bytea;
  e         jsonb;
begin
  -- 1) El local: activo, y si solo tiene retiro no acepta domicilio.
  select n.id, n.tasa_bs, coalesce(c.delivery_modo, 'cotizado') as modo into v_neg
  from public.negocios n left join public.agente_config c on c.negocio_id = n.id
  where n.slug = p_negocio and n.activo;
  if not found then raise exception 'negocio_no_disponible' using errcode = 'P0002'; end if;
  if coalesce(p_entrega, '') not in ('retiro', 'domicilio') then raise exception 'entrega_invalida' using errcode = '22023'; end if;
  if p_entrega = 'domicilio' and v_neg.modo = 'retiro' then raise exception 'solo_retiro' using errcode = '22023'; end if;

  -- 2) Forma de las líneas, antes de tocar tablas.
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'items_invalidos' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(e) <> 'object'
       or coalesce(e->>'producto', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(e->>'cantidad', '') !~ '^[1-9][0-9]?$' then
      raise exception 'items_invalidos' using errcode = '22023';
    end if;
  end loop;

  -- 3) Productos del local, disponibles, de categorías visibles y sin repetir. El total sale de la base.
  select count(*), count(p.id), sum(p.precio_usd * x.cantidad),
         jsonb_agg(jsonb_build_object('codigo', left(p.id::text, 8), 'cantidad', x.cantidad))
  into v_lineas, v_validas, v_total, v_items
  from (select distinct on ((e2->>'producto')::uuid) (e2->>'producto')::uuid as producto, (e2->>'cantidad')::int as cantidad
        from jsonb_array_elements(p_items) e2) x
  left join public.productos p
    on p.id = x.producto and p.negocio_id = v_neg.id and p.disponible
   and (p.categoria_id is null or exists (select 1 from public.categorias c where c.id = p.categoria_id and c.activa));
  if v_lineas <> jsonb_array_length(p_items) or v_validas <> v_lineas then
    raise exception 'productos_no_disponibles' using errcode = '22023';
  end if;

  -- 4) Topes contra el abuso (la función es pública) y limpieza de lo viejo.
  if (select count(*) from public.pedidos_web w where w.negocio_id = v_neg.id and w.creado_en > now() - interval '1 minute') >= 30
     or (select count(*) from public.pedidos_web w where w.creado_en > now() - interval '1 minute') >= 300
     or (select count(*) from public.pedidos_web w where w.negocio_id = v_neg.id and w.creado_en > now() - interval '1 day') >= 2000 then
    raise exception 'demasiados_pedidos' using errcode = '54000';
  end if;
  delete from public.pedidos_web w where w.creado_en < now() - interval '2 days';

  -- 5) Código de 6 caracteres al azar (31^6 ≈ 900 millones); si choca con uno vivo, otro intento.
  for intento in 1..5 loop
    v_bytes := uuid_send(gen_random_uuid());
    v_codigo := '';
    for i in 0..5 loop
      v_codigo := v_codigo || substr(alfabeto, (get_byte(v_bytes, i) % 31) + 1, 1);
    end loop;
    begin
      insert into public.pedidos_web (codigo, negocio_id, items, entrega, total_usd, tasa_bs)
      values (v_codigo, v_neg.id, v_items, p_entrega, round(v_total, 2), v_neg.tasa_bs);
      return v_codigo;
    exception when unique_violation then
      null;
    end;
  end loop;
  raise exception 'sin_codigo' using errcode = '55000';
end
$$;

-- ---------------------------------------------------------------------------
-- El agente busca el pedido por su código. Solo si es del local de esa instancia y no venció (24 h).
-- ---------------------------------------------------------------------------
create or replace function public.agente_pedido_web(p_instancia text, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select w.items, w.entrega, w.total_usd, w.tasa_bs, w.creado_en, n.slug into v
  from public.pedidos_web w join public.negocios n on n.id = w.negocio_id
  where w.codigo = upper(coalesce(p_codigo, '')) and n.evolution_instance_name = p_instancia;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_encontrado'); end if;
  if v.creado_en < now() - interval '24 hours' then return jsonb_build_object('ok', false, 'error', 'vencido'); end if;
  return jsonb_build_object('ok', true, 'slug', v.slug, 'items', v.items, 'entrega', v.entrega,
                            'total_usd', v.total_usd, 'tasa_bs', v.tasa_bs);
end
$$;

-- Supabase da EXECUTE a anon y authenticated en funciones nuevas: se quita y se da solo a quien corresponde.
revoke all on function public.guardar_pedido_web(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.guardar_pedido_web(text, jsonb, text) to anon, authenticated, service_role;
revoke all on function public.agente_pedido_web(text, text) from public, anon, authenticated;
grant execute on function public.agente_pedido_web(text, text) to service_role;

commit;
