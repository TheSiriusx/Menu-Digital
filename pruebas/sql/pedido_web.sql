-- Pruebas de la migración 0013 (código corto del pedido del menú). Crea sus propios locales de prueba:
-- no depende de los datos reales. Todo corre en UNA transacción que termina con error a propósito.
-- Uso: python3 pruebas/probar_sql.py pruebas/sql/pedido_web.sql --con-migraciones 0013   (mientras no esté aplicada)
do $$
declare
  own uuid := gen_random_uuid();
  nid uuid; otro uuid; cat uuid; oculta uuid; p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid;
  cod text; viejo text;
  r text := ''; t record; n bigint; txt text; obtenido text; detalle text; fallos int := 0; total int := 0;
  sent text; toks text[]; i int;
begin
  -- ============================== preparación (como superusuario)
  insert into auth.users (id, email) values (own, 'own-web@x.test');
  insert into public.negocios (slug, nombre, tasa_bs, evolution_instance_name) values ('zz-web', 'Web', 100, 'menu-zz-web') returning id into nid;
  insert into public.negocios (slug, nombre, evolution_instance_name) values ('zz-otro', 'Otro', 'menu-zz-otro') returning id into otro;
  insert into public.perfiles (id, negocio_id, rol) values (own, nid, 'dueno');
  insert into public.categorias (negocio_id, nombre) values (nid, 'Visible') returning id into cat;
  insert into public.categorias (negocio_id, nombre, activa) values (nid, 'Oculta', false) returning id into oculta;
  insert into public.productos (negocio_id, categoria_id, nombre, precio_usd) values (nid, cat, 'Uno', 1.50) returning id into p1;
  insert into public.productos (negocio_id, categoria_id, nombre, precio_usd) values (nid, null, 'Dos', 2.00) returning id into p2;
  insert into public.productos (negocio_id, categoria_id, nombre, precio_usd, disponible) values (nid, cat, 'Agotado', 1, false) returning id into p3;
  insert into public.productos (negocio_id, categoria_id, nombre, precio_usd) values (nid, oculta, 'En oculta', 1) returning id into p4;
  insert into public.productos (negocio_id, nombre, precio_usd) values (otro, 'Ajeno', 1) returning id into p5;
  update public.agente_config set delivery_modo = 'cotizado' where negocio_id = nid;
  cod := public.guardar_pedido_web('zz-web', jsonb_build_array(jsonb_build_object('producto', p1, 'cantidad', 2), jsonb_build_object('producto', p2, 'cantidad', 1)), 'retiro');
  viejo := public.guardar_pedido_web('zz-web', jsonb_build_array(jsonb_build_object('producto', p2, 'cantidad', 1)), 'retiro');
  update public.pedidos_web set creado_en = now() - interval '25 hours' where codigo = viejo;

  toks := array[':nid', nid::text, ':otro', otro::text, ':p1', p1::text, ':p2', p2::text, ':p3', p3::text, ':p4', p4::text,
                ':p5', p5::text, ':cod', cod, ':viejo', viejo, ':minus', lower(cod)];

  for t in select * from (values
    -- ==================== 1) el menú (público) guarda el carrito y recibe un código
    ('anon', 'guarda y devuelve un código de 6',             'select (public.guardar_pedido_web(''zz-web'', ''[{"producto":":p1","cantidad":3}]'', ''retiro'') ~ ''^[2-9A-HJKMNP-Z]{6}$'')::text', 'val=true'),
    ('postgres', 'el total sale de la base (2×1,50 + 2,00)', 'select total_usd::text from public.pedidos_web where codigo = '':cod''', 'val=5.00'),
    ('postgres', 'guarda códigos de 8 para crear_pedido',    'select (items @> (''[{"codigo":"'' || left('':p1'', 8) || ''","cantidad":2}]'')::jsonb)::text from public.pedidos_web where codigo = '':cod''', 'val=true'),
    ('postgres', 'guarda la tasa del local',                 'select tasa_bs::text from public.pedidos_web where codigo = '':cod''', 'val=100.0000'),
    ('own',  'con sesión de dueño también puede (menú)',     'select (public.guardar_pedido_web(''zz-web'', ''[{"producto":":p2","cantidad":1}]'', ''retiro'') is not null)::text', 'val=true'),

    -- ==================== 2) lo que no acepta
    ('anon', 'producto agotado',                             'select public.guardar_pedido_web(''zz-web'', ''[{"producto":":p3","cantidad":1}]'', ''retiro'')', 'error'),
    ('anon', 'producto de una categoría oculta',             'select public.guardar_pedido_web(''zz-web'', ''[{"producto":":p4","cantidad":1}]'', ''retiro'')', 'error'),
    ('anon', 'producto de OTRO local',                       'select public.guardar_pedido_web(''zz-web'', ''[{"producto":":p5","cantidad":1}]'', ''retiro'')', 'error'),
    ('anon', 'producto repetido en dos líneas',              'select public.guardar_pedido_web(''zz-web'', ''[{"producto":":p1","cantidad":1},{"producto":":p1","cantidad":1}]'', ''retiro'')', 'error'),
    ('anon', 'cantidad 0',                                   'select public.guardar_pedido_web(''zz-web'', ''[{"producto":":p1","cantidad":0}]'', ''retiro'')', 'error'),
    ('anon', 'cantidad 100',                                 'select public.guardar_pedido_web(''zz-web'', ''[{"producto":":p1","cantidad":100}]'', ''retiro'')', 'error'),
    ('anon', 'cantidad con texto',                           'select public.guardar_pedido_web(''zz-web'', ''[{"producto":":p1","cantidad":"2; drop"}]'', ''retiro'')', 'error'),
    ('anon', 'id que no es uuid',                            'select public.guardar_pedido_web(''zz-web'', ''[{"producto":"x'''' or 1=1","cantidad":1}]'', ''retiro'')', 'error'),
    ('anon', 'lista vacía',                                  'select public.guardar_pedido_web(''zz-web'', ''[]'', ''retiro'')', 'error'),
    ('anon', '51 líneas',                                    'select public.guardar_pedido_web(''zz-web'', (select jsonb_agg(jsonb_build_object(''producto'', gen_random_uuid(), ''cantidad'', 1)) from generate_series(1, 51)), ''retiro'')', 'error'),
    ('anon', 'no es una lista',                              'select public.guardar_pedido_web(''zz-web'', ''{"producto":":p1"}'', ''retiro'')', 'error'),
    ('anon', 'local que no existe',                          'select public.guardar_pedido_web(''no-existe'', ''[{"producto":":p1","cantidad":1}]'', ''retiro'')', 'error'),
    ('anon', 'entrega desconocida',                          'select public.guardar_pedido_web(''zz-web'', ''[{"producto":":p1","cantidad":1}]'', ''avion'')', 'error'),
    ('anon', 'domicilio con delivery «cotizado»: sí',        'select (public.guardar_pedido_web(''zz-web'', ''[{"producto":":p1","cantidad":1}]'', ''domicilio'') is not null)::text', 'val=true'),
    ('postgres', '(preparación) el local pasa a solo retiro', 'update public.agente_config set delivery_modo = ''retiro'' where negocio_id = '':nid''', 'rows=1'),
    ('anon', 'domicilio con solo retiro: no',                'select public.guardar_pedido_web(''zz-web'', ''[{"producto":":p1","cantidad":1}]'', ''domicilio'')', 'error'),
    ('postgres', '(preparación) local pausado',              'update public.negocios set activo = false where id = '':nid''', 'rows=1'),
    ('anon', 'local pausado: no',                            'select public.guardar_pedido_web(''zz-web'', ''[{"producto":":p1","cantidad":1}]'', ''retiro'')', 'error'),
    ('postgres', '(preparación) local activo otra vez',      'update public.negocios set activo = true where id = '':nid''', 'rows=1'),

    -- ==================== 3) la tabla no la toca nadie más
    ('anon', 'público: leer pedidos_web',                    'select * from public.pedidos_web', 'error'),
    ('anon', 'público: escribir directo',                    'insert into public.pedidos_web (codigo, negocio_id, items, entrega, total_usd, tasa_bs) values (''ZZZZZZ'', '':nid'', ''[]'', ''retiro'', 0, 0)', 'error'),
    ('own',  'dueño: leer pedidos_web',                      'select * from public.pedidos_web', 'error'),
    ('own',  'dueño: borrar pedidos_web',                    'delete from public.pedidos_web', 'error'),

    -- ==================== 4) el agente lo busca por el código
    ('anon', 'público: agente_pedido_web',                   'select public.agente_pedido_web(''menu-zz-web'', '':cod'')', 'error'),
    ('own',  'dueño: agente_pedido_web',                     'select public.agente_pedido_web(''menu-zz-web'', '':cod'')', 'error'),
    ('service_role', 'agente: lo encuentra',                 'select public.agente_pedido_web(''menu-zz-web'', '':cod'') ->> ''ok''', 'val=true'),
    ('service_role', 'agente: trae el local y la entrega',   'select (public.agente_pedido_web(''menu-zz-web'', '':cod'') ->> ''slug'') || ''/'' || (public.agente_pedido_web(''menu-zz-web'', '':cod'') ->> ''entrega'')', 'val=zz-web/retiro'),
    ('service_role', 'agente: trae las 2 líneas',            'select jsonb_array_length(public.agente_pedido_web(''menu-zz-web'', '':cod'') -> ''items'')::text', 'val=2'),
    ('service_role', 'agente: acepta el código en minúsculas', 'select public.agente_pedido_web(''menu-zz-web'', '':minus'') ->> ''ok''', 'val=true'),
    ('service_role', 'agente: desde la instancia de OTRO local', 'select public.agente_pedido_web(''menu-zz-otro'', '':cod'') ->> ''error''', 'val=no_encontrado'),
    ('service_role', 'agente: código inexistente',           'select public.agente_pedido_web(''menu-zz-web'', ''ZZZZZZ'') ->> ''error''', 'val=no_encontrado'),
    ('service_role', 'agente: código de hace 25 h',          'select public.agente_pedido_web(''menu-zz-web'', '':viejo'') ->> ''error''', 'val=vencido'),
    ('service_role', 'agente: registra con crear_pedido',    'select public.crear_pedido(''menu-zz-web'', ''zz-web'', ''999000000077'', ''Prueba'', public.agente_pedido_web(''menu-zz-web'', '':cod'') -> ''items'', null, ''retiro'', null, null, ''web-:cod'') ->> ''ok''', 'val=true'),
    ('service_role', 'el mismo código otra vez: duplicado',  'select public.crear_pedido(''menu-zz-web'', ''zz-web'', ''999000000077'', ''Prueba'', public.agente_pedido_web(''menu-zz-web'', '':cod'') -> ''items'', null, ''retiro'', null, null, ''web-:cod'') ->> ''duplicado''', 'val=true'),
    ('postgres', 'quedó UN solo pedido con ese código',      'select count(*)::text from public.pedidos where origen_mensaje_id = ''web-:cod''', 'val=1'),

    -- ==================== 5) limpieza y topes
    ('postgres', '(preparación) un código de hace 3 días',   'insert into public.pedidos_web (codigo, negocio_id, items, entrega, total_usd, tasa_bs, creado_en) values (''YYYYYY'', '':nid'', ''[]'', ''retiro'', 0, 0, now() - interval ''3 days'')', 'rows=1'),
    ('anon', 'guardar otro pedido…',                         'select (public.guardar_pedido_web(''zz-web'', ''[{"producto":":p1","cantidad":1}]'', ''retiro'') is not null)::text', 'val=true'),
    ('postgres', '…borra los de más de 2 días',              'select count(*)::text from public.pedidos_web where codigo = ''YYYYYY''', 'val=0'),
    ('postgres', '(preparación) 30 pedidos en el último minuto', 'insert into public.pedidos_web (codigo, negocio_id, items, entrega, total_usd, tasa_bs) select ''WW'' || substr(''23456789ABCDEFGHJKMNPQRSTUVWXYZ'', g / 31 + 1, 1) || substr(''23456789ABCDEFGHJKMNPQRSTUVWXYZ'', g % 31 + 1, 1) || ''WW'', '':nid'', ''[]'', ''retiro'', 0, 0 from generate_series(1, 30) g', 'rows=30'),
    ('anon', 'el 31.º del minuto: rechazado',                'select public.guardar_pedido_web(''zz-web'', ''[{"producto":":p1","cantidad":1}]'', ''retiro'')', 'error'),
    ('postgres', '(preparación) se vacía el minuto',          'delete from public.pedidos_web where codigo like ''WW%''', 'rows=30'),
    ('anon', 'pasado el tope, vuelve a aceptar',             'select (public.guardar_pedido_web(''zz-web'', ''[{"producto":":p1","cantidad":1}]'', ''retiro'') is not null)::text', 'val=true')
  ) as v(quien, nombre, sentencia, esperado) loop
    total := total + 1;
    execute 'reset role';
    if t.quien = 'anon' then
      execute 'set local role anon';
    elsif t.quien = 'service_role' then
      execute 'set local role service_role';
    elsif t.quien <> 'postgres' then
      perform set_config('request.jwt.claims', json_build_object('sub', own, 'role', 'authenticated')::text, true);
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
           || rpad(t.nombre, 50) || ' esperado ' || rpad(t.esperado, 18) || ' obtenido ' || obtenido || detalle || E'\n';
  end loop;

  execute 'reset role';
  raise exception E'RESULTADOS\n%\n% de % pruebas correctas', r, total - fallos, total;
end
$$;
