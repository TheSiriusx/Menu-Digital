-- 0011_agente_panaderias.sql
-- Lo que necesita el agente de WhatsApp para panaderías (carpeta agente/):
--   agente_config   configuración del asistente de cada local (la edita el dueño en su panel)
--   agente_avisos   cola de mensajes a enviar: cambios de estado al cliente, reseña, recordatorios al dueño
--   agente_*()      funciones que usa el agente con la clave de servicio (nadie más puede llamarlas)
--
-- Principios (los mismos de 0008): el público no ve nada de esto; un dueño solo ve y edita lo de su local
-- (y solo si su local está activo); el stock exacto nunca sale, salvo «quedan N» cuando quedan pocas.

begin;

-- ---------------------------------------------------------------------------
-- Horario semanal: {"lunes":[{"desde":"06:00","hasta":"19:00"}], ... , "domingo":[]}. Hasta 3 tramos por día.
-- ---------------------------------------------------------------------------
create or replace function public._horario_valido(h jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  t jsonb;
  hora constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
begin
  if h is null or jsonb_typeof(h) <> 'object' then return false; end if;
  for k in select jsonb_object_keys(h) loop
    if k not in ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo') then return false; end if;
    if jsonb_typeof(h -> k) <> 'array' or jsonb_array_length(h -> k) > 3 then return false; end if;
    for t in select * from jsonb_array_elements(h -> k) loop
      if jsonb_typeof(t) <> 'object'
         or coalesce(t ->> 'desde', '') !~ hora
         or (coalesce(t ->> 'hasta', '') !~ hora and t ->> 'hasta' is distinct from '24:00')
         or (t ->> 'desde') >= (t ->> 'hasta') then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end
$$;

-- ---------------------------------------------------------------------------
-- agente_config: una fila por local (se crea sola al crear el local).
-- ---------------------------------------------------------------------------
create table public.agente_config (
  negocio_id             uuid primary key references public.negocios (id) on delete cascade,
  agente_activo          boolean      not null default true,         -- «apagar» / «encender»
  pausado_hasta          timestamptz,                                -- «apagar 3h»
  horario                jsonb        not null default '{
    "lunes":[{"desde":"06:00","hasta":"19:00"}], "martes":[{"desde":"06:00","hasta":"19:00"}],
    "miercoles":[{"desde":"06:00","hasta":"19:00"}], "jueves":[{"desde":"06:00","hasta":"19:00"}],
    "viernes":[{"desde":"06:00","hasta":"19:00"}], "sabado":[{"desde":"06:00","hasta":"19:00"}],
    "domingo":[{"desde":"06:00","hasta":"13:00"}]}'::jsonb,
  acepta_fuera_horario   boolean      not null default true,         -- registra pedidos con el local cerrado
  datos_pago             text         not null default '',           -- pago móvil, Zelle... (texto que se le da al cliente)
  pago_momento           text         not null default 'al_registrar',
  delivery_modo          text         not null default 'retiro',
  delivery_tarifa_usd    numeric(8,2),
  delivery_texto         text         not null default '',           -- zonas, condiciones
  resena_url             text,                                       -- sin enlace no se pide reseña
  resena_espera_min      integer      not null default 120,
  telefono_dueno         text,                                       -- avisos; vacío = el propio WhatsApp del local
  recordatorio_1_min     integer               default 10,           -- pedido «nuevo» sin atender
  recordatorio_2_min     integer               default 30,
  stock_aviso_umbral     integer      not null default 5,            -- «quedan N» si hay N o menos (0 = nunca)
  encargo_aviso_horas    integer      not null default 48,
  pedido_grande_usd      numeric(10,2) not null default 100,
  pedido_grande_unidades integer      not null default 50,
  actualizado_en         timestamptz  not null default now(),

  constraint agente_config_horario     check (public._horario_valido(horario)),
  constraint agente_config_pago        check (pago_momento in ('al_registrar', 'al_confirmar')),
  constraint agente_config_delivery    check (delivery_modo in ('retiro', 'cotizado', 'tarifa')),
  constraint agente_config_tarifa      check (delivery_tarifa_usd is null or delivery_tarifa_usd between 0 and 1000),
  constraint agente_config_tarifa_modo check (delivery_modo <> 'tarifa' or delivery_tarifa_usd is not null),
  constraint agente_config_textos      check (char_length(datos_pago) <= 600 and char_length(delivery_texto) <= 300),
  constraint agente_config_resena      check (resena_url is null or (resena_url ~ '^https://[^\s<>"]+$' and char_length(resena_url) <= 300)),
  constraint agente_config_espera      check (resena_espera_min between 10 and 2880),
  constraint agente_config_telefono    check (telefono_dueno is null or telefono_dueno ~ '^[0-9]{10,15}$'),
  constraint agente_config_recordatorio check ((recordatorio_1_min is null or recordatorio_1_min between 1 and 240)
                                           and (recordatorio_2_min is null or recordatorio_2_min between 1 and 240)),
  constraint agente_config_umbral      check (stock_aviso_umbral between 0 and 100),
  constraint agente_config_encargo     check (encargo_aviso_horas between 0 and 720),
  constraint agente_config_grande      check (pedido_grande_usd between 1 and 100000 and pedido_grande_unidades between 1 and 999)
);

create or replace function public._agente_config_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end
$$;

create trigger agente_config_actualizado
  before update on public.agente_config
  for each row execute function public._agente_config_actualizado();

-- Cada local nuevo nace con su configuración (y los que ya existen la reciben ahora).
create or replace function public._negocio_crea_agente_config()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.agente_config (negocio_id) values (new.id) on conflict do nothing;
  return null;
end
$$;

create trigger negocios_crea_agente_config
  after insert on public.negocios
  for each row execute function public._negocio_crea_agente_config();

insert into public.agente_config (negocio_id) select id from public.negocios on conflict do nothing;

-- Permisos: Supabase da todo a anon/authenticated en tablas nuevas; se quita y se da solo lo necesario.
alter table public.agente_config enable row level security;
revoke all on public.agente_config from anon, authenticated;
grant select on public.agente_config to authenticated;
grant update (agente_activo, pausado_hasta, horario, acepta_fuera_horario, datos_pago, pago_momento, delivery_modo,
              delivery_tarifa_usd, delivery_texto, resena_url, resena_espera_min, telefono_dueno,
              recordatorio_1_min, recordatorio_2_min, stock_aviso_umbral, encargo_aviso_horas,
              pedido_grande_usd, pedido_grande_unidades)
  on public.agente_config to authenticated;

create policy agente_config_dueno_lee
  on public.agente_config for select to authenticated
  using (negocio_id = (select public.mi_negocio_id()));
create policy agente_config_dueno_actualiza
  on public.agente_config for update to authenticated
  using (negocio_id = (select public.mi_negocio_activo_id()))
  with check (negocio_id = (select public.mi_negocio_activo_id()));
create policy agente_config_superadmin_lee
  on public.agente_config for select to authenticated
  using ((select public.es_superadmin()));
create policy agente_config_superadmin_actualiza
  on public.agente_config for update to authenticated
  using ((select public.es_superadmin()))
  with check ((select public.es_superadmin()));

-- ---------------------------------------------------------------------------
-- agente_avisos: cola de mensajes que el agente envía (consulta cada pocos segundos).
--   clave  'estado:<estado>'  al cliente, cuando el dueño cambia el estado
--          'resena'           al cliente, un rato después de «entregado» (si el local tiene enlace)
--          'recordatorio:1|2' al dueño, si el pedido sigue «nuevo»
-- Solo la usa el agente (service_role): ni el público ni los dueños la ven.
-- ---------------------------------------------------------------------------
create table public.agente_avisos (
  id             bigint generated always as identity primary key,
  negocio_id     uuid        not null references public.negocios (id) on delete cascade,
  pedido_id      uuid        not null references public.pedidos (id) on delete cascade,
  clave          text        not null,
  enviar_despues timestamptz not null default now(),
  tomado_en      timestamptz,
  enviado_en     timestamptz,
  anulado_en     timestamptz,
  intentos       integer     not null default 0,
  ultimo_error   text,
  creado_en      timestamptz not null default now(),

  constraint agente_avisos_clave check (clave ~ '^(estado:(confirmado|pagado|listo|entregado|cancelado)|resena|recordatorio:[12])$'),
  constraint agente_avisos_unico unique (pedido_id, clave)
);

create index agente_avisos_pendientes_idx on public.agente_avisos (enviar_despues)
  where enviado_en is null and anulado_en is null;

alter table public.agente_avisos enable row level security;
revoke all on public.agente_avisos from anon, authenticated;

-- Encola los avisos al crear un pedido o cambiar su estado.
-- Si el cambio lo hizo el propio agente a pedido del cliente (p. ej. «cancela mi pedido»), el agente ya le
-- respondió en la conversación: marca la transacción con agente.silencio = on y no se encola el aviso de estado.
create or replace function public._pedidos_avisos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
begin
  select a.recordatorio_1_min, a.recordatorio_2_min, a.resena_url, a.resena_espera_min into c
  from public.agente_config a where a.negocio_id = new.negocio_id;

  if tg_op = 'INSERT' then
    if new.estado = 'nuevo' and c.recordatorio_1_min is not null then
      insert into public.agente_avisos (negocio_id, pedido_id, clave, enviar_despues)
      values (new.negocio_id, new.id, 'recordatorio:1', new.created_at + make_interval(mins => c.recordatorio_1_min))
      on conflict do nothing;
    end if;
    if new.estado = 'nuevo' and c.recordatorio_2_min is not null then
      insert into public.agente_avisos (negocio_id, pedido_id, clave, enviar_despues)
      values (new.negocio_id, new.id, 'recordatorio:2', new.created_at + make_interval(mins => c.recordatorio_2_min))
      on conflict do nothing;
    end if;
    return null;
  end if;

  if new.estado is distinct from old.estado then
    -- Solo importa el estado más reciente: lo que quedó sin enviar de antes ya no se manda.
    update public.agente_avisos
       set anulado_en = now()
     where pedido_id = new.id and enviado_en is null and anulado_en is null
       and (clave like 'recordatorio:%' or clave like 'estado:%');

    if coalesce(current_setting('agente.silencio', true), '') <> 'on' then
      insert into public.agente_avisos (negocio_id, pedido_id, clave)
      values (new.negocio_id, new.id, 'estado:' || new.estado)
      on conflict do nothing;
    end if;

    if new.estado = 'entregado' and c.resena_url is not null then
      insert into public.agente_avisos (negocio_id, pedido_id, clave, enviar_despues)
      values (new.negocio_id, new.id, 'resena', now() + make_interval(mins => c.resena_espera_min))
      on conflict do nothing;
    end if;
  end if;
  return null;
end
$$;

create trigger pedidos_avisos
  after insert or update of estado on public.pedidos
  for each row execute function public._pedidos_avisos();

-- ---------------------------------------------------------------------------
-- Funciones del agente (solo service_role). El local SIEMPRE sale de la instancia de WhatsApp.
-- ---------------------------------------------------------------------------

-- Todo lo que el agente necesita saber del local, en una llamada.
create or replace function public.agente_contexto(p_instancia text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
              'ok', true,
              'negocio', jsonb_build_object('id', n.id, 'slug', n.slug, 'nombre', n.nombre, 'activo', n.activo,
                                            'tasa_bs', n.tasa_bs, 'telefono', n.telefono_whatsapp, 'horario', n.horario),
              'config', to_jsonb(c) - 'negocio_id')
       from public.negocios n
       left join public.agente_config c on c.negocio_id = n.id
      where n.evolution_instance_name = p_instancia),
    jsonb_build_object('ok', false, 'error', 'negocio_no_encontrado'))
$$;

-- Menú real del local: lo que se puede vender. Nunca el stock exacto: «quedan» solo si hay pocas unidades.
create or replace function public.agente_menu(p_instancia text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(m.fila order by m.orden_cat, m.orden_prod), '[]'::jsonb)
  from (
    select jsonb_build_object(
             'codigo', left(p.id::text, 8),
             'nombre', p.nombre,
             'descripcion', p.descripcion,
             'precio_usd', p.precio_usd,
             'disponible', p.disponible,
             'categoria', cat.nombre,
             'quedan', case when p.stock is not null and p.disponible and u.umbral > 0 and p.stock <= u.umbral
                            then p.stock end) as fila,
           coalesce(cat.orden, 2147483647) as orden_cat,
           p.orden as orden_prod
    from public.negocios n
    join public.productos p on p.negocio_id = n.id
    left join public.categorias cat on cat.id = p.categoria_id
    cross join lateral (
      select coalesce((select a.stock_aviso_umbral from public.agente_config a where a.negocio_id = n.id), 5) as umbral
    ) u
    where n.evolution_instance_name = p_instancia
      and n.activo
      and coalesce(cat.activa, true)          -- las categorías ocultas no existen para el cliente
    order by 2, 3
    limit 300
  ) m
$$;

-- Los últimos pedidos de ese cliente en ese local (para «¿cómo va mi pedido?» y «cancélalo»).
create or replace function public.agente_pedidos_cliente(p_instancia text, p_telefono text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(s.fila order by s.creado desc), '[]'::jsonb)
  from (
    select p.created_at as creado,
           jsonb_build_object(
             'codigo', left(p.id::text, 8), 'estado', p.estado, 'total_usd', p.total_usd,
             'entrega', p.entrega, 'creado', p.created_at,
             'items', (select coalesce(jsonb_agg(jsonb_build_object('nombre', i.nombre_producto, 'cantidad', i.cantidad)
                                                 order by i.nombre_producto), '[]'::jsonb)
                       from public.pedido_items i where i.pedido_id = p.id)) as fila
    from public.pedidos p
    join public.negocios n on n.id = p.negocio_id
    where n.evolution_instance_name = p_instancia
      and p.cliente_telefono = regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g')
    order by p.created_at desc
    limit 5
  ) s
$$;

-- El cliente cancela SU pedido, y solo si el dueño todavía no lo atendió (estado «nuevo»). Devuelve el stock.
create or replace function public.agente_cancelar_pedido(p_instancia text, p_telefono text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_neg uuid;
  v_ped record;
  v_cuantos integer;
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  v_cod text := lower(btrim(coalesce(p_codigo, '')));
begin
  if v_cod !~ '^[0-9a-f]{8}$' then return jsonb_build_object('ok', false, 'error', 'codigo_invalido'); end if;
  if v_tel !~ '^[0-9]{10,15}$' then return jsonb_build_object('ok', false, 'error', 'telefono_invalido'); end if;

  select n.id into v_neg from public.negocios n where n.evolution_instance_name = p_instancia;
  if v_neg is null then return jsonb_build_object('ok', false, 'error', 'negocio_no_encontrado'); end if;

  select count(*) into v_cuantos from public.pedidos p
  where p.negocio_id = v_neg and p.cliente_telefono = v_tel and left(p.id::text, 8) = v_cod;
  if v_cuantos <> 1 then return jsonb_build_object('ok', false, 'error', 'pedido_no_encontrado'); end if;

  select p.id, p.estado into v_ped from public.pedidos p
  where p.negocio_id = v_neg and p.cliente_telefono = v_tel and left(p.id::text, 8) = v_cod
  for update;
  if v_ped.estado <> 'nuevo' then
    return jsonb_build_object('ok', false, 'error', 'ya_en_proceso', 'estado', v_ped.estado);
  end if;

  perform set_config('agente.silencio', 'on', true);   -- el agente ya le responde en la conversación
  perform public._cambiar_estado_pedido(v_ped.id, 'cancelado');
  return jsonb_build_object('ok', true, 'codigo', v_cod, 'estado', 'cancelado');
end
$$;

-- Comando del dueño «pedidos»: los de hoy (hora de Venezuela).
create or replace function public.agente_pedidos_hoy(p_instancia text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(s.fila order by s.creado), '[]'::jsonb)
  from (
    select p.created_at as creado,
           jsonb_build_object('codigo', left(p.id::text, 8), 'estado', p.estado, 'total_usd', p.total_usd,
                              'entrega', p.entrega, 'nombre', p.cliente_nombre, 'telefono', p.cliente_telefono,
                              'creado', p.created_at) as fila
    from public.pedidos p
    join public.negocios n on n.id = p.negocio_id
    where n.evolution_instance_name = p_instancia
      and (p.created_at at time zone 'America/Caracas')::date = (now() at time zone 'America/Caracas')::date
    order by p.created_at desc
    limit 40
  ) s
$$;

-- Comandos del dueño «apagar», «apagar 3h» y «encender».
create or replace function public.agente_encendido(p_instancia text, p_modo text, p_horas integer default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_neg uuid;
  c record;
begin
  select n.id into v_neg from public.negocios n where n.evolution_instance_name = p_instancia;
  if v_neg is null then return jsonb_build_object('ok', false, 'error', 'negocio_no_encontrado'); end if;

  if p_modo = 'encender' then
    update public.agente_config set agente_activo = true, pausado_hasta = null where negocio_id = v_neg;
  elsif p_modo = 'apagar' and p_horas is null then
    update public.agente_config set agente_activo = false, pausado_hasta = null where negocio_id = v_neg;
  elsif p_modo = 'apagar' and p_horas between 1 and 168 then
    update public.agente_config set agente_activo = true, pausado_hasta = now() + make_interval(hours => p_horas)
     where negocio_id = v_neg;
  else
    return jsonb_build_object('ok', false, 'error', 'modo_invalido');
  end if;

  select a.agente_activo, a.pausado_hasta into c from public.agente_config a where a.negocio_id = v_neg;
  return jsonb_build_object('ok', true, 'agente_activo', c.agente_activo, 'pausado_hasta', c.pausado_hasta);
end
$$;

-- Toma avisos listos para enviar (sin que dos agentes tomen el mismo). Un aviso tomado y no confirmado en
-- 5 minutos (el agente se reinició a mitad) vuelve a quedar disponible. Máximo 5 intentos.
create or replace function public.agente_avisos_tomar(p_limite integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resultado jsonb;
begin
  with elegidos as (
    select a.id
    from public.agente_avisos a
    where a.enviado_en is null and a.anulado_en is null and a.enviar_despues <= now() and a.intentos < 5
      and (a.tomado_en is null or a.tomado_en < now() - interval '5 minutes')
    order by a.enviar_despues
    limit least(greatest(coalesce(p_limite, 20), 1), 50)
    for update skip locked
  ), tomados as (
    update public.agente_avisos a
       set tomado_en = now(), intentos = a.intentos + 1
      from elegidos e
     where a.id = e.id
    returning a.id, a.clave, a.negocio_id, a.pedido_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id,
           'clave', t.clave,
           'instancia', n.evolution_instance_name,
           'negocio', jsonb_build_object('nombre', n.nombre, 'slug', n.slug, 'activo', n.activo,
                                         'tasa_bs', n.tasa_bs, 'telefono', n.telefono_whatsapp),
           'config', to_jsonb(c) - 'negocio_id',
           'pedido', jsonb_build_object(
              'codigo', left(p.id::text, 8), 'estado', p.estado, 'total_usd', p.total_usd, 'entrega', p.entrega,
              'direccion', p.direccion, 'telefono', p.cliente_telefono, 'nombre', p.cliente_nombre, 'creado', p.created_at,
              'items', (select coalesce(jsonb_agg(jsonb_build_object('nombre', i.nombre_producto, 'cantidad', i.cantidad,
                                                                     'precio_unitario_usd', i.precio_unitario_usd)
                                                  order by i.nombre_producto), '[]'::jsonb)
                        from public.pedido_items i where i.pedido_id = p.id))
         ) order by t.id), '[]'::jsonb)
    into resultado
  from tomados t
  join public.negocios n on n.id = t.negocio_id
  join public.pedidos p on p.id = t.pedido_id
  left join public.agente_config c on c.negocio_id = t.negocio_id;
  return resultado;
end
$$;

-- Resultado del envío de un aviso. Si falló, se reintenta más tarde (1, 2, 3... minutos).
create or replace function public.agente_aviso_resultado(p_id bigint, p_ok boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(p_ok, false) then
    update public.agente_avisos set enviado_en = now(), ultimo_error = null where id = p_id;
  else
    update public.agente_avisos
       set tomado_en = null,
           ultimo_error = left(coalesce(p_error, 'error'), 300),
           enviar_despues = now() + make_interval(mins => greatest(intentos, 1))
     where id = p_id;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución. Supabase da EXECUTE a anon y authenticated en funciones nuevas: se quita.
-- ---------------------------------------------------------------------------
revoke all on function
  public._agente_config_actualizado(),
  public._negocio_crea_agente_config(),
  public._pedidos_avisos(),
  public.agente_contexto(text),
  public.agente_menu(text),
  public.agente_pedidos_cliente(text, text),
  public.agente_cancelar_pedido(text, text, text),
  public.agente_pedidos_hoy(text),
  public.agente_encendido(text, text, integer),
  public.agente_avisos_tomar(integer),
  public.agente_aviso_resultado(bigint, boolean, text)
from public, anon, authenticated;

grant execute on function
  public.agente_contexto(text),
  public.agente_menu(text),
  public.agente_pedidos_cliente(text, text),
  public.agente_cancelar_pedido(text, text, text),
  public.agente_pedidos_hoy(text),
  public.agente_encendido(text, text, integer),
  public.agente_avisos_tomar(integer),
  public.agente_aviso_resultado(bigint, boolean, text)
to service_role;

-- El chequeo del horario lo evalúa quien guarda la configuración (el dueño desde su panel).
revoke all on function public._horario_valido(jsonb) from public, anon;
grant execute on function public._horario_valido(jsonb) to authenticated, service_role;

commit;
