-- Pruebas de la migración 0014 (métricas: visitas, tiempo de respuesta y lecturas para el super admin).
-- Crea sus propios locales de prueba; todo corre en UNA transacción que termina con error a propósito.
-- Uso: python3 pruebas/probar_sql.py pruebas/sql/metricas.sql --con-migraciones 0014   (mientras no esté aplicada)
do $$
declare
  own uuid := gen_random_uuid(); sa uuid := gen_random_uuid();
  nid uuid; otro uuid; pausado uuid; prod uuid; ped uuid;
  hoy date := (now() at time zone 'America/Caracas')::date;
  ped_ayer bigint; vis_hoy bigint;   -- datos reales de otros locales (los totales por día los suman)
  r text := ''; t record; n bigint; txt text; obtenido text; detalle text; fallos int := 0; total int := 0;
  sent text; toks text[]; i int;
begin
  -- ============================== preparación (como superusuario)
  insert into auth.users (id, email) values (own, 'own-met@x.test'), (sa, 'sa-met@x.test');
  insert into public.negocios (slug, nombre, evolution_instance_name) values ('zz-met', 'Met', 'menu-zz-met') returning id into nid;
  insert into public.negocios (slug, nombre, evolution_instance_name) values ('zz-met2', 'Met2', 'menu-zz-met2') returning id into otro;
  insert into public.negocios (slug, nombre, activo) values ('zz-pausa', 'Pausa', false) returning id into pausado;
  insert into public.perfiles (id, negocio_id, rol) values (own, nid, 'dueno'), (sa, null, 'superadmin');
  insert into public.productos (negocio_id, nombre, precio_usd) values (nid, 'Café', 1.50) returning id into prod;
  insert into public.visitas_menu (negocio_id, dia, visitas) values (otro, hoy, 7);
  perform set_config('agente.silencio', 'on', true);
  ped := (public.crear_pedido('menu-zz-met', 'zz-met', '999000000081', 'Uno', jsonb_build_array(jsonb_build_object('codigo', left(prod::text, 8), 'cantidad', 2)), null, 'retiro', null, null, 'met-1') ->> 'pedido_id')::uuid;
  perform public.crear_pedido('menu-zz-met', 'zz-met', '999000000082', 'Dos', jsonb_build_array(jsonb_build_object('codigo', left(prod::text, 8), 'cantidad', 1)), null, 'retiro', null, null, 'met-2');
  update public.pedidos set estado = 'confirmado' where id = ped;   -- solo este cuenta como venta (2 × 1,50)
  perform set_config('agente.silencio', '', true);

  select count(*) into ped_ayer from public.pedidos where (created_at at time zone 'America/Caracas')::date = hoy - 1;
  select coalesce(sum(visitas), 0) into vis_hoy from public.visitas_menu where dia = hoy and negocio_id not in (nid, otro);
  toks := array[':pedayer', ped_ayer::text, ':vishoy', vis_hoy::text, ':nid', nid::text, ':otro', otro::text, ':pausado', pausado::text, ':hoy', hoy::text, ':ayer', (hoy - 1)::text];

  for t in select * from (values
    -- ==================== 1) visitas: el menú (público) suma una por llamada
    ('anon', 'cuenta una visita',                           'select public.contar_visita(''zz-met'')', 'rows=1'),
    ('postgres', 'quedó 1 visita hoy',                      'select visitas::text from public.visitas_menu where negocio_id = '':nid'' and dia = '':hoy''', 'val=1'),
    ('anon', 'otra visita',                                 'select public.contar_visita(''zz-met'')', 'rows=1'),
    ('postgres', 'van 2',                                   'select visitas::text from public.visitas_menu where negocio_id = '':nid'' and dia = '':hoy''', 'val=2'),
    ('anon', 'local pausado: no falla…',                    'select public.contar_visita(''zz-pausa'')', 'rows=1'),
    ('postgres', '…pero no cuenta',                         'select count(*)::text from public.visitas_menu where negocio_id = '':pausado''', 'val=0'),
    ('anon', 'local que no existe: no falla',               'select public.contar_visita(''no-existe'')', 'rows=1'),
    ('postgres', '(preparación) llegar al tope del día',     'update public.visitas_menu set visitas = 20000 where negocio_id = '':nid''', 'rows=1'),
    ('anon', 'con el tope…',                                'select public.contar_visita(''zz-met'')', 'rows=1'),
    ('postgres', '…ya no sube',                             'select visitas::text from public.visitas_menu where negocio_id = '':nid'' and dia = '':hoy''', 'val=20000'),
    ('postgres', '(preparación) vuelta a 2',                'update public.visitas_menu set visitas = 2 where negocio_id = '':nid''', 'rows=1'),

    -- ==================== 2) la tabla de visitas: nadie escribe directo; cada uno lee lo suyo
    ('anon', 'público: leer visitas',                       'select * from public.visitas_menu', 'error'),
    ('anon', 'público: escribir visitas',                   'insert into public.visitas_menu (negocio_id, dia, visitas) values ('':nid'', '':hoy'', 999)', 'error'),
    ('own',  'dueño: lee SUS visitas',                      'select * from public.visitas_menu', 'rows=1'),
    ('own',  'dueño: no ve las de otro local',              'select * from public.visitas_menu where negocio_id = '':otro''', 'rows=0'),
    ('own',  'dueño: no puede inflarlas',                   'update public.visitas_menu set visitas = 999', 'error'),
    ('sa',   'super admin: ve todas',                       'select * from public.visitas_menu where negocio_id in ('':nid'', '':otro'')', 'rows=2'),

    -- ==================== 3) tiempo de respuesta: solo el agente anota
    ('anon', 'público: anotar respuesta',                   'select public.agente_registrar_respuesta(''menu-zz-met'', 5)', 'error'),
    ('own',  'dueño: anotar respuesta',                     'select public.agente_registrar_respuesta(''menu-zz-met'', 5)', 'error'),
    ('service_role', 'agente: anota 10 s',                  'select public.agente_registrar_respuesta(''menu-zz-met'', 10)', 'rows=1'),
    ('service_role', 'agente: anota 20 s',                  'select public.agente_registrar_respuesta(''menu-zz-met'', 20)', 'rows=1'),
    ('service_role', 'agente: anota 60 s',                  'select public.agente_registrar_respuesta(''menu-zz-met'', 60)', 'rows=1'),
    ('service_role', 'segundos negativos: se ignoran',      'select public.agente_registrar_respuesta(''menu-zz-met'', -3)', 'rows=1'),
    ('service_role', 'instancia que no existe: se ignora',  'select public.agente_registrar_respuesta(''menu-nadie'', 5)', 'rows=1'),
    ('postgres', 'quedaron 3 respuestas',                   'select count(*)::text from public.agente_respuestas where negocio_id = '':nid''', 'val=3'),
    ('postgres', '(preparación) una de hace 100 días',      'insert into public.agente_respuestas (negocio_id, segundos, creado_en) values ('':nid'', 9, now() - interval ''100 days'')', 'rows=1'),
    ('service_role', 'anotar otra…',                        'select public.agente_registrar_respuesta(''menu-zz-met2'', 30)', 'rows=1'),
    ('postgres', '…borra las de más de 90 días',            'select count(*)::text from public.agente_respuestas where segundos = 9', 'val=0'),
    ('anon', 'público: leer respuestas',                    'select * from public.agente_respuestas', 'error'),
    ('own',  'dueño: lee solo las suyas',                   'select * from public.agente_respuestas', 'rows=3'),
    ('own',  'dueño: no puede escribirlas',                 'delete from public.agente_respuestas', 'error'),

    -- ==================== 4) métricas por local (RLS decide qué ve cada quien)
    ('sa',   'visitas de hoy',                              'select visitas::text from public.metricas_locales('':hoy'', '':hoy'') where negocio_id = '':nid''', 'val=2'),
    ('sa',   'pedidos por WhatsApp (todos los estados)',    'select pedidos::text from public.metricas_locales('':hoy'', '':hoy'') where negocio_id = '':nid''', 'val=2'),
    ('sa',   'ventas: solo confirmados en adelante',        'select ventas_usd::text from public.metricas_locales('':hoy'', '':hoy'') where negocio_id = '':nid''', 'val=3.00'),
    ('sa',   'respuestas contadas',                         'select respuestas::text from public.metricas_locales('':hoy'', '':hoy'') where negocio_id = '':nid''', 'val=3'),
    ('sa',   'tiempo típico (mediana de 10, 20, 60)',       'select respuesta_mediana_s::text from public.metricas_locales('':hoy'', '':hoy'') where negocio_id = '':nid''', 'val=20.0'),
    ('sa',   'el otro local, con sus datos',                'select visitas || ''/'' || respuesta_mediana_s from public.metricas_locales('':hoy'', '':hoy'') where negocio_id = '':otro''', 'val=7/30.0'),
    ('sa',   'ayer: nada',                                  'select visitas || ''/'' || pedidos || ''/'' || respuestas from public.metricas_locales('':ayer'', '':ayer'') where negocio_id = '':nid''', 'val=0/0/0'),
    ('own',  'dueño: sus métricas',                         'select visitas || ''/'' || pedidos from public.metricas_locales('':hoy'', '':hoy'') where negocio_id = '':nid''', 'val=2/2'),
    ('own',  'dueño: las del otro local salen en cero',     'select visitas || ''/'' || pedidos || ''/'' || respuestas from public.metricas_locales('':hoy'', '':hoy'') where negocio_id = '':otro''', 'val=0/0/0'),
    ('anon', 'público: métricas',                           'select * from public.metricas_locales('':hoy'', '':hoy'')', 'error'),

    -- ==================== 5) totales por día
    ('sa',   'un día por fila, con ceros',                  'select count(*)::text from public.metricas_diarias('':ayer'', '':hoy'')', 'val=2'),
    ('sa',   'hoy suma los dos locales (2 + 7 visitas)',    'select (visitas - :vishoy)::text from public.metricas_diarias('':hoy'', '':hoy'')', 'val=9'),
    ('sa',   'ayer: ningún pedido de prueba',                                'select (pedidos - :pedayer)::text from public.metricas_diarias('':ayer'', '':ayer'')', 'val=0'),
    ('own',  'dueño: solo sus visitas en el total',         'select visitas::text from public.metricas_diarias('':hoy'', '':hoy'')', 'val=2'),
    ('anon', 'público: totales por día',                    'select * from public.metricas_diarias('':hoy'', '':hoy'')', 'error')
  ) as v(quien, nombre, sentencia, esperado) loop
    total := total + 1;
    execute 'reset role';
    if t.quien = 'anon' then
      execute 'set local role anon';
    elsif t.quien = 'service_role' then
      execute 'set local role service_role';
    elsif t.quien <> 'postgres' then
      perform set_config('request.jwt.claims', json_build_object('sub', case t.quien when 'own' then own else sa end, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
    end if;
    sent := t.sentencia;
    i := 1; while i < array_length(toks, 1) loop sent := replace(sent, toks[i], toks[i + 1]); i := i + 2; end loop;
    detalle := '';
    begin
      if t.esperado like 'val=%' then
        execute sent into txt;
        obtenido := 'val=' || coalesce(txt, 'NULL');
      else
        execute sent;
        get diagnostics n = row_count;
        obtenido := 'rows=' || n;
      end if;
    exception when others then
      obtenido := 'error'; detalle := ' [' || left(sqlerrm, 70) || ']';
    end;
    if obtenido <> t.esperado then fallos := fallos + 1; end if;
    r := r || case when obtenido = t.esperado then 'OK    ' else 'FALLA ' end
           || rpad(t.nombre, 46) || ' esperado ' || rpad(t.esperado, 14) || ' obtenido ' || obtenido || detalle || E'\n';
  end loop;

  execute 'reset role';
  raise exception E'RESULTADOS\n%\n% de % pruebas correctas', r, total - fallos, total;
end
$$;
