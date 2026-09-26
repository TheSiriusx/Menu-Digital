-- Pruebas de las migraciones 0010 (estado «listo») y 0011 (agente de panaderías).
-- Todo corre en UNA transacción que termina con un error a propósito: no queda nada guardado.
-- Uso: python3 pruebas/probar_sql.py pruebas/sql/agente11.sql   (con --con-migraciones si aún no se aplicaron)
do $$
declare
  own uuid := gen_random_uuid(); own2 uuid := gen_random_uuid(); sa uuid := gen_random_uuid();
  nid uuid; otro uuid; canilla uuid; integral uuid; c1 text; c3 text;
  ped1 uuid; ped2 uuid; ped3 uuid;
  r text := ''; t record; n bigint; txt text; obtenido text; detalle text; fallos int := 0; total int := 0;
  sent text; toks text[]; i int;
begin
  -- ============================== preparación (como superusuario)
  select id into nid from public.negocios where slug = 'nueva-victoria';
  insert into auth.users (id, email) values (own, 'own@x.test'), (own2, 'own2@x.test'), (sa, 'sa@x.test');
  insert into public.negocios (slug, nombre) values ('zz-ajeno', 'Ajeno') returning id into otro;
  insert into public.perfiles (id, negocio_id, rol) values (own, nid, 'dueno'), (own2, otro, 'dueno'), (sa, null, 'superadmin');
  update public.negocios set evolution_instance_name = 'menu-nueva-victoria' where id = nid;
  update public.negocios set evolution_instance_name = 'menu-zz-ajeno' where id = otro;
  insert into public.productos (negocio_id, nombre, precio_usd) values (otro, 'Prod ajeno', 1);
  select id into canilla  from public.productos where negocio_id = nid and nombre = 'Pan canilla';
  select id into integral from public.productos where negocio_id = nid and nombre = 'Pan integral';
  update public.productos set stock = 4,  disponible = true where id = canilla;    -- quedan pocas (≤ 5)
  update public.productos set stock = 10, disponible = true where id = integral;   -- hay de sobra
  c1 := left(canilla::text, 8); c3 := left(integral::text, 8);
  update public.agente_config set resena_url = 'https://g.page/r/prueba' where negocio_id = nid;

  ped1 := (public.crear_pedido('menu-nueva-victoria', 'nueva-victoria', '999000000001', 'Ana',
           jsonb_build_array(jsonb_build_object('codigo', c1, 'cantidad', 1)), null, 'retiro', null, null, 't-1') ->> 'pedido_id')::uuid;
  ped2 := (public.crear_pedido('menu-nueva-victoria', 'nueva-victoria', '999000000002', 'Beto',
           jsonb_build_array(jsonb_build_object('codigo', c3, 'cantidad', 2)), null, 'retiro', null, null, 't-2') ->> 'pedido_id')::uuid;
  ped3 := (public.crear_pedido('menu-nueva-victoria', 'nueva-victoria', '999000000002', 'Beto',
           jsonb_build_array(jsonb_build_object('codigo', c3, 'cantidad', 1)), null, 'retiro', null, null, 't-3') ->> 'pedido_id')::uuid;

  toks := array[':nid', nid::text, ':otro', otro::text, ':ped1', ped1::text, ':ped2', ped2::text, ':ped3', ped3::text,
                ':c1', c1, ':c3', c3, ':cod2', left(ped2::text, 8), ':cod3', left(ped3::text, 8)];

  for t in select * from (values
    -- ==================== 1) nadie de afuera ve nada del agente
    ('anon', 'anon: leer agente_config',                       'select * from public.agente_config', 'error'),
    ('anon', 'anon: leer agente_avisos',                       'select * from public.agente_avisos', 'error'),
    ('anon', 'anon: agente_contexto',                          'select public.agente_contexto(''menu-nueva-victoria'')', 'error'),
    ('anon', 'anon: agente_menu',                              'select public.agente_menu(''menu-nueva-victoria'')', 'error'),
    ('own',  'dueño: leer agente_avisos',                      'select * from public.agente_avisos', 'error'),
    ('own',  'dueño: agente_menu (solo el agente)',            'select public.agente_menu(''menu-nueva-victoria'')', 'error'),
    ('own',  'dueño: agente_avisos_tomar',                     'select public.agente_avisos_tomar(5)', 'error'),
    ('own',  'dueño: agente_cancelar_pedido',                  'select public.agente_cancelar_pedido(''menu-nueva-victoria'', ''999000000002'', '':cod2'')', 'error'),
    ('own',  'dueño: agente_encendido',                        'select public.agente_encendido(''menu-nueva-victoria'', ''apagar'')', 'error'),

    -- ==================== 2) configuración: el dueño la suya, el super admin todas
    ('postgres', 'un local nuevo nace con su configuración',   'select count(*)::text from public.agente_config where negocio_id = '':otro''', 'val=1'),
    ('own',  'dueño: lee SU configuración',                    'select * from public.agente_config', 'rows=1'),
    ('own2', 'otro dueño: no ve la mía',                       'select * from public.agente_config where negocio_id = '':nid''', 'rows=0'),
    ('sa',   'super admin: ve todas',                          'select * from public.agente_config', 'rows=2'),
    ('own',  'dueño: guarda sus datos de pago',                'update public.agente_config set datos_pago = ''Pago móvil 0412'' where negocio_id = '':nid''', 'rows=1'),
    ('own',  'dueño: config de OTRO local',                    'update public.agente_config set datos_pago = ''x'' where negocio_id = '':otro''', 'rows=0'),
    ('own',  'dueño: cambiar negocio_id',                      'update public.agente_config set negocio_id = '':otro'' where negocio_id = '':nid''', 'error'),
    ('own',  'dueño: crear otra configuración',                'insert into public.agente_config (negocio_id) values ('':otro'')', 'error'),
    ('own',  'dueño: borrar su configuración',                 'delete from public.agente_config where negocio_id = '':nid''', 'error'),
    ('own',  'horario al revés',                               'update public.agente_config set horario = ''{"lunes":[{"desde":"19:00","hasta":"06:00"}]}'' where negocio_id = '':nid''', 'error'),
    ('own',  'horario con un día inventado',                   'update public.agente_config set horario = ''{"feriado":[]}'' where negocio_id = '':nid''', 'error'),
    ('own',  'horario con hora inválida',                      'update public.agente_config set horario = ''{"lunes":[{"desde":"25:00","hasta":"26:00"}]}'' where negocio_id = '':nid''', 'error'),
    ('own',  'horario válido (domingo cerrado, 2 tramos)',     'update public.agente_config set horario = ''{"lunes":[{"desde":"06:00","hasta":"12:00"},{"desde":"14:00","hasta":"19:00"}],"domingo":[]}'' where negocio_id = '':nid''', 'rows=1'),
    ('own',  'reseña con enlace javascript:',                  'update public.agente_config set resena_url = ''javascript:alert(1)'' where negocio_id = '':nid''', 'error'),
    ('own',  'teléfono del dueño con letras',                  'update public.agente_config set telefono_dueno = ''abc'' where negocio_id = '':nid''', 'error'),
    ('own',  'delivery con tarifa pero sin monto',             'update public.agente_config set delivery_modo = ''tarifa'', delivery_tarifa_usd = null where negocio_id = '':nid''', 'error'),
    ('own',  'delivery con tarifa de $2',                      'update public.agente_config set delivery_modo = ''tarifa'', delivery_tarifa_usd = 2 where negocio_id = '':nid''', 'rows=1'),
    ('postgres', '(preparación) pausar el local',              'update public.negocios set activo = false where id = '':nid''', 'rows=1'),
    ('own',  'PAUSADO: el dueño no puede editar',              'update public.agente_config set datos_pago = ''y'' where negocio_id = '':nid''', 'rows=0'),
    ('sa',   'PAUSADO: el super admin sí',                     'update public.agente_config set datos_pago = ''z'' where negocio_id = '':nid''', 'rows=1'),
    ('service_role', 'PAUSADO: el menú no ofrece nada',        'select jsonb_array_length(public.agente_menu(''menu-nueva-victoria''))::text', 'val=0'),
    ('postgres', '(preparación) reactivar el local',           'update public.negocios set activo = true where id = '':nid''', 'rows=1'),

    -- ==================== 3) lo que ve el agente
    ('service_role', 'contexto: ok',                           'select public.agente_contexto(''menu-nueva-victoria'') ->> ''ok''', 'val=true'),
    ('service_role', 'contexto: el local es el de la instancia', 'select public.agente_contexto(''menu-nueva-victoria'') -> ''negocio'' ->> ''slug''', 'val=nueva-victoria'),
    ('service_role', 'contexto: trae la configuración',        'select public.agente_contexto(''menu-nueva-victoria'') -> ''config'' ->> ''delivery_modo''', 'val=tarifa'),
    ('service_role', 'contexto: instancia desconocida',        'select public.agente_contexto(''no-existe'') ->> ''error''', 'val=negocio_no_encontrado'),
    ('service_role', 'menú: los 16 productos del local',       'select jsonb_array_length(public.agente_menu(''menu-nueva-victoria''))::text', 'val=16'),
    ('service_role', 'menú: NUNCA el stock exacto',            'select count(*)::text from jsonb_array_elements(public.agente_menu(''menu-nueva-victoria'')) e where e ? ''stock''', 'val=0'),
    ('service_role', 'menú: «quedan» cuando hay pocas (4)',    'select e ->> ''quedan'' from jsonb_array_elements(public.agente_menu(''menu-nueva-victoria'')) e where e ->> ''nombre'' = ''Pan canilla''', 'val=3'),
    ('service_role', 'menú: sin «quedan» cuando sobra',        'select coalesce(e ->> ''quedan'', ''no'') from jsonb_array_elements(public.agente_menu(''menu-nueva-victoria'')) e where e ->> ''nombre'' = ''Pan integral''', 'val=no'),
    ('service_role', 'menú: código de 8 caracteres',           'select e ->> ''codigo'' from jsonb_array_elements(public.agente_menu(''menu-nueva-victoria'')) e where e ->> ''nombre'' = ''Pan canilla''', 'val=:c1'),
    ('service_role', 'menú: no mezcla locales',                'select jsonb_array_length(public.agente_menu(''menu-zz-ajeno''))::text', 'val=1'),
    ('postgres', '(preparación) ocultar Bebidas',              'update public.categorias set activa = false where negocio_id = '':nid'' and nombre = ''Bebidas''', 'rows=1'),
    ('service_role', 'menú: sin la categoría oculta',          'select jsonb_array_length(public.agente_menu(''menu-nueva-victoria''))::text', 'val=12'),
    ('postgres', '(preparación) mostrar Bebidas',              'update public.categorias set activa = true where negocio_id = '':nid'' and nombre = ''Bebidas''', 'rows=1'),
    ('service_role', 'pedidos del cliente: los suyos',         'select jsonb_array_length(public.agente_pedidos_cliente(''menu-nueva-victoria'', ''999000000002''))::text', 'val=2'),
    ('service_role', 'pedidos del cliente: número con formato', 'select jsonb_array_length(public.agente_pedidos_cliente(''menu-nueva-victoria'', ''+999 000-000-002''))::text', 'val=2'),
    ('service_role', 'pedidos del cliente: no de otro local',  'select jsonb_array_length(public.agente_pedidos_cliente(''menu-zz-ajeno'', ''999000000002''))::text', 'val=0'),
    ('service_role', 'pedidos de hoy',                          'select jsonb_array_length(public.agente_pedidos_hoy(''menu-nueva-victoria''))::text', 'val=3'),

    -- ==================== 4) estado «listo» y avisos automáticos
    ('postgres', 'pedido nuevo: 2 recordatorios al dueño',     'select string_agg(clave, '','' order by clave) from public.agente_avisos where pedido_id = '':ped1''', 'val=recordatorio:1,recordatorio:2'),
    ('postgres', 'recordatorio a los 10 min',                   'select (extract(epoch from (a.enviar_despues - p.created_at)) / 60)::int::text from public.agente_avisos a join public.pedidos p on p.id = a.pedido_id where a.pedido_id = '':ped1'' and a.clave = ''recordatorio:1''', 'val=10'),
    ('own',  'nuevo -> listo (no permitido)',                   'select public.cambiar_estado_pedido('':ped3'', ''listo'')', 'error'),
    ('own',  'nuevo -> confirmado',                              'select public.cambiar_estado_pedido('':ped1'', ''confirmado'')', 'val=confirmado'),
    ('postgres', 'al atenderlo se anulan los recordatorios',    'select string_agg(clave || case when anulado_en is null then '''' else ''(x)'' end, '','' order by clave) from public.agente_avisos where pedido_id = '':ped1''', 'val=estado:confirmado,recordatorio:1(x),recordatorio:2(x)'),
    ('own',  'confirmado -> listo',                              'select public.cambiar_estado_pedido('':ped1'', ''listo'')', 'val=listo'),
    ('postgres', 'solo cuenta el último estado sin enviar',     'select string_agg(clave, '','' order by clave) from public.agente_avisos where pedido_id = '':ped1'' and anulado_en is null', 'val=estado:listo'),
    ('own',  'listo -> pagado (paga al retirar)',                'select public.cambiar_estado_pedido('':ped1'', ''pagado'')', 'val=pagado'),
    ('own',  'pagado -> entregado',                              'select public.cambiar_estado_pedido('':ped1'', ''entregado'')', 'val=entregado'),
    ('own',  'entregado -> listo (no permitido)',                'select public.cambiar_estado_pedido('':ped1'', ''listo'')', 'error'),
    ('postgres', 'entregado: aviso + reseña',                   'select string_agg(clave, '','' order by clave) from public.agente_avisos where pedido_id = '':ped1'' and anulado_en is null', 'val=estado:entregado,resena'),
    ('postgres', 'la reseña espera ~2 horas',                   'select (extract(epoch from (enviar_despues - now())) / 60)::int::text from public.agente_avisos where pedido_id = '':ped1'' and clave = ''resena''', 'val=120'),
    ('own',  'ventas de hoy cuentan «listo» y confirmados',     'select coalesce(sum(pedidos), 0)::text from public.ventas_por_periodo('':nid'', (now() at time zone ''America/Caracas'')::date, (now() at time zone ''America/Caracas'')::date)', 'val=1'),
    ('own',  'ped3: nuevo -> confirmado',                        'select public.cambiar_estado_pedido('':ped3'', ''confirmado'')', 'val=confirmado'),
    ('own',  'ped3: confirmado -> listo (venta)',                'select public.cambiar_estado_pedido('':ped3'', ''listo'')', 'val=listo'),
    ('own',  'ventas: «listo» cuenta como venta',               'select coalesce(sum(pedidos), 0)::text from public.ventas_por_periodo('':nid'', (now() at time zone ''America/Caracas'')::date, (now() at time zone ''America/Caracas'')::date)', 'val=2'),

    -- ==================== 5) el cliente cancela SU pedido, solo si sigue «nuevo»
    ('service_role', 'cancelar: código mal formado',             'select public.agente_cancelar_pedido(''menu-nueva-victoria'', ''999000000002'', ''zzz'') ->> ''error''', 'val=codigo_invalido'),
    ('service_role', 'cancelar: pedido de OTRO cliente',         'select public.agente_cancelar_pedido(''menu-nueva-victoria'', ''999000000001'', '':cod2'') ->> ''error''', 'val=pedido_no_encontrado'),
    ('service_role', 'cancelar: desde la instancia de otro local', 'select public.agente_cancelar_pedido(''menu-zz-ajeno'', ''999000000002'', '':cod2'') ->> ''error''', 'val=pedido_no_encontrado'),
    ('service_role', 'cancelar: pedido ya en proceso',           'select public.agente_cancelar_pedido(''menu-nueva-victoria'', ''999000000002'', '':cod3'') ->> ''error''', 'val=ya_en_proceso'),
    ('service_role', 'cancelar: el suyo, en «nuevo» (mayúsculas)', 'select public.agente_cancelar_pedido(''menu-nueva-victoria'', ''999000000002'', upper('':cod2'')) ->> ''ok''', 'val=true'),
    ('postgres', 'cancelar devuelve el stock (10-2-1+2)',        'select stock::text from public.productos where id = (select id from public.productos where left(id::text, 8) = '':c3'')', 'val=9'),
    ('postgres', 'sin aviso de estado (ya se lo dijo el agente)', 'select count(*)::text from public.agente_avisos where pedido_id = '':ped2'' and anulado_en is null', 'val=0'),
    ('postgres', '(preparación) fin del silencio',               'select set_config(''agente.silencio'', '''', true)', 'val='),
    ('service_role', 'cancelar dos veces',                        'select public.agente_cancelar_pedido(''menu-nueva-victoria'', ''999000000002'', '':cod2'') ->> ''error''', 'val=ya_en_proceso'),

    -- ==================== 6) comandos del dueño
    ('service_role', 'apagar 3h',                                'select (public.agente_encendido(''menu-nueva-victoria'', ''apagar'', 3) ->> ''pausado_hasta'') is not null', 'val=true'),
    ('service_role', 'apagar (sin horas)',                       'select public.agente_encendido(''menu-nueva-victoria'', ''apagar'') ->> ''agente_activo''', 'val=false'),
    ('service_role', 'encender',                                 'select public.agente_encendido(''menu-nueva-victoria'', ''encender'') ->> ''agente_activo''', 'val=true'),
    ('service_role', 'apagar 999h (fuera de rango)',             'select public.agente_encendido(''menu-nueva-victoria'', ''apagar'', 999) ->> ''error''', 'val=modo_invalido'),
    ('service_role', 'modo inventado',                           'select public.agente_encendido(''menu-nueva-victoria'', ''borrar'') ->> ''error''', 'val=modo_invalido'),

    -- ==================== 7) cola de avisos
    ('postgres', '(preparación) vencer todos los pendientes',    'update public.agente_avisos set enviar_despues = now() - interval ''1 second'' where enviado_en is null and anulado_en is null', 'rows=3'),
    ('service_role', 'tomar: los 3 pendientes',                  'select jsonb_array_length(public.agente_avisos_tomar(50))::text', 'val=3'),
    ('service_role', 'tomar otra vez: nada (ya tomados)',        'select jsonb_array_length(public.agente_avisos_tomar(50))::text', 'val=0'),
    ('service_role', 'enviado OK',                               'select public.agente_aviso_resultado((select min(id) from public.agente_avisos where tomado_en is not null and enviado_en is null), true)', 'val='),
    ('service_role', 'falló: se reintenta más tarde',            'select public.agente_aviso_resultado((select max(id) from public.agente_avisos where tomado_en is not null and enviado_en is null), false, ''sin conexión'')', 'val='),
    ('postgres', 'queda 1 enviado',                              'select count(*)::text from public.agente_avisos where enviado_en is not null', 'val=1'),
    ('service_role', 'el fallido no vuelve enseguida',            'select jsonb_array_length(public.agente_avisos_tomar(50))::text', 'val=0')
  ) as v(quien, nombre, sentencia, esperado) loop
    total := total + 1;
    execute 'reset role';
    if t.quien = 'anon' then
      execute 'set local role anon';
    elsif t.quien = 'service_role' then
      execute 'set local role service_role';
    elsif t.quien <> 'postgres' then
      perform set_config('request.jwt.claims', json_build_object('sub', case t.quien when 'own' then own when 'own2' then own2 else sa end, 'role', 'authenticated')::text, true);
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
    t.esperado := replace(t.esperado, ':c1', c1);
    if obtenido <> t.esperado then fallos := fallos + 1; end if;
    r := r || case when obtenido = t.esperado then 'OK    ' else 'FALLA ' end
           || rpad(t.nombre, 58) || ' esperado ' || rpad(t.esperado, 22) || ' obtenido ' || obtenido || detalle || E'\n';
  end loop;

  execute 'reset role';
  raise exception E'RESULTADOS\n%\n% de % pruebas correctas', r, total - fallos, total;
end
$$;
