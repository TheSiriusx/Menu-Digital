-- 0014_metricas.sql
-- Métricas reales para el super admin: visitas al menú, tiempo de respuesta del agente y, con lo que ya
-- existía, pedidos por WhatsApp y ventas. Las lecturas respetan RLS: el super admin ve todos los locales y un
-- dueño solo el suyo (por si más adelante se muestran en su panel). Nada de esto toca datos existentes.
--
-- Visitas: la página del menú, ya cargada en el navegador, llama a contar_visita (una vez por día y local en
-- cada navegador; los bots y las vistas previas de enlaces no ejecutan esa llamada). Es la segunda función
-- pública (como guardar_pedido_web): solo suma 1 en un contador diario, con tope por local y por día.
-- Tiempo de respuesta: el agente anota los segundos entre el mensaje del cliente y su primera respuesta.

begin;

-- ---------------------------------------------------------------------------
-- Visitas al menú: un contador por local y día (hora de Venezuela).
-- ---------------------------------------------------------------------------
create table public.visitas_menu (
  negocio_id uuid    not null references public.negocios (id) on delete cascade,
  dia        date    not null,
  visitas    integer not null default 0 check (visitas >= 0),
  primary key (negocio_id, dia)
);
alter table public.visitas_menu enable row level security;
revoke all on public.visitas_menu from anon, authenticated;
grant select on public.visitas_menu to authenticated;
create policy visitas_menu_dueno_lee on public.visitas_menu for select to authenticated
  using (negocio_id = (select public.mi_negocio_id()));
create policy visitas_menu_superadmin_lee on public.visitas_menu for select to authenticated
  using ((select public.es_superadmin()));

create or replace function public.contar_visita(p_negocio text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select n.id into v_id from public.negocios n where n.slug = p_negocio and n.activo;
  if v_id is null then return; end if;   -- local inexistente o pausado: no cuenta, sin error
  insert into public.visitas_menu as v (negocio_id, dia, visitas)
  values (v_id, (now() at time zone 'America/Caracas')::date, 1)
  on conflict (negocio_id, dia) do update set visitas = v.visitas + 1
    where v.visitas < 20000;              -- tope diario: nadie infla la cifra sin límite
end
$$;

-- ---------------------------------------------------------------------------
-- Tiempo de respuesta del agente: una fila por respuesta, se guardan 90 días.
-- ---------------------------------------------------------------------------
create table public.agente_respuestas (
  id         bigint      generated always as identity primary key,
  negocio_id uuid        not null references public.negocios (id) on delete cascade,
  segundos   integer     not null check (segundos between 0 and 86400),
  creado_en  timestamptz not null default now()
);
create index agente_respuestas_negocio_creado on public.agente_respuestas (negocio_id, creado_en);
create index agente_respuestas_creado on public.agente_respuestas (creado_en);
alter table public.agente_respuestas enable row level security;
revoke all on public.agente_respuestas from anon, authenticated;
grant select on public.agente_respuestas to authenticated;
create policy agente_respuestas_dueno_lee on public.agente_respuestas for select to authenticated
  using (negocio_id = (select public.mi_negocio_id()));
create policy agente_respuestas_superadmin_lee on public.agente_respuestas for select to authenticated
  using ((select public.es_superadmin()));

create or replace function public.agente_registrar_respuesta(p_instancia text, p_segundos integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_segundos is null or p_segundos < 0 or p_segundos > 86400 then return; end if;
  insert into public.agente_respuestas (negocio_id, segundos)
  select n.id, p_segundos from public.negocios n where n.evolution_instance_name = p_instancia;
  delete from public.agente_respuestas r where r.creado_en < now() - interval '90 days';
end
$$;

-- ---------------------------------------------------------------------------
-- Lecturas (con los permisos de quien llama: RLS decide qué locales ve).
-- ---------------------------------------------------------------------------
-- Por local, entre dos fechas (inclusive, hora de Venezuela).
create or replace function public.metricas_locales(p_desde date, p_hasta date)
returns table (negocio_id uuid, visitas bigint, pedidos bigint, ventas_usd numeric, respuestas bigint, respuesta_mediana_s numeric)
language sql
stable
set search_path = ''
as $$
  select n.id,
         coalesce((select sum(v.visitas) from public.visitas_menu v
                   where v.negocio_id = n.id and v.dia between p_desde and p_hasta), 0)::bigint,
         (select count(*) from public.pedidos p
          where p.negocio_id = n.id and (p.created_at at time zone 'America/Caracas')::date between p_desde and p_hasta),
         coalesce((select sum(p.total_usd) from public.pedidos p
                   where p.negocio_id = n.id and p.estado in ('confirmado', 'pagado', 'listo', 'entregado')
                     and (p.created_at at time zone 'America/Caracas')::date between p_desde and p_hasta), 0),
         (select count(*) from public.agente_respuestas r
          where r.negocio_id = n.id and (r.creado_en at time zone 'America/Caracas')::date between p_desde and p_hasta),
         (select round(percentile_cont(0.5) within group (order by r.segundos)::numeric, 1) from public.agente_respuestas r
          where r.negocio_id = n.id and (r.creado_en at time zone 'America/Caracas')::date between p_desde and p_hasta)
  from public.negocios n
$$;

-- Totales por día (todos los locales que quien llama puede ver), con ceros en los días sin datos.
create or replace function public.metricas_diarias(p_desde date, p_hasta date)
returns table (dia date, visitas bigint, pedidos bigint, ventas_usd numeric)
language sql
stable
set search_path = ''
as $$
  select d::date,
         coalesce((select sum(v.visitas) from public.visitas_menu v where v.dia = d::date), 0)::bigint,
         (select count(*) from public.pedidos p where (p.created_at at time zone 'America/Caracas')::date = d::date),
         coalesce((select sum(p.total_usd) from public.pedidos p
                   where p.estado in ('confirmado', 'pagado', 'listo', 'entregado')
                     and (p.created_at at time zone 'America/Caracas')::date = d::date), 0)
  from generate_series(p_desde, least(p_hasta, p_desde + 366), interval '1 day') d
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución (Supabase da EXECUTE a anon y authenticated en funciones nuevas).
-- ---------------------------------------------------------------------------
revoke all on function public.contar_visita(text) from public, anon, authenticated;
grant execute on function public.contar_visita(text) to anon, authenticated, service_role;
revoke all on function public.agente_registrar_respuesta(text, integer) from public, anon, authenticated;
grant execute on function public.agente_registrar_respuesta(text, integer) to service_role;
revoke all on function public.metricas_locales(date, date), public.metricas_diarias(date, date) from public, anon;
grant execute on function public.metricas_locales(date, date), public.metricas_diarias(date, date) to authenticated, service_role;

commit;
