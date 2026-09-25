do $$
declare
  own uuid := gen_random_uuid(); own2 uuid := gen_random_uuid(); sa uuid := gen_random_uuid();
  nid uuid; otro uuid; canilla uuid; sobado uuid; integral uuid; pzz uuid; cat_bebidas uuid;
  cli1 uuid; clix uuid; ped1 uuid; ped2 uuid; pedx uuid; ped_r uuid;
  c1 text; c2 text; c3 text; cz text;
  r text := ''; t record; n bigint; txt text; obtenido text; detalle text; fallos int := 0; total int := 0;
  sent text; toks text[]; i int; base_stock bigint;
begin
  -- ============================== preparación (como superusuario; todo se revierte)
  select id into nid from public.negocios where slug = 'nueva-victoria';
  insert into auth.users (id, email) values (own, 'own@x.test'), (own2, 'own2@x.test'), (sa, 'sa@x.test');
  insert into public.negocios (slug, nombre) values ('zz-ajeno', 'Ajeno') returning id into otro;
  insert into public.perfiles (id, negocio_id, rol) values (own, nid, 'dueno'), (own2, otro, 'dueno'), (sa, null, 'superadmin');
  update public.negocios set evolution_instance_name = 'menu-nueva-victoria' where id = nid;
  update public.negocios set evolution_instance_name = 'menu-zz-ajeno' where id = otro;
  insert into public.productos (negocio_id, nombre, precio_usd, stock) values (otro, 'Prod ajeno', 1, 3) returning id into pzz;
  select id into canilla  from public.productos where negocio_id = nid and nombre = 'Pan canilla';
  select id into sobado   from public.productos where negocio_id = nid and nombre = 'Pan sobado';
  select id into integral from public.productos where negocio_id = nid and nombre = 'Pan integral';
  select id into cat_bebidas from public.categorias where negocio_id = nid and nombre = 'Bebidas';
  update public.productos set stock = 5,    disponible = true where id = canilla;
  update public.productos set stock = null, disponible = true where id = sobado;
  update public.productos set stock = 10,   disponible = true where id = integral;
  c1 := left(canilla::text, 8); c2 := left(sobado::text, 8); c3 := left(integral::text, 8); cz := left(pzz::text, 8);

  insert into public.clientes (negocio_id, telefono, nombre) values (nid, '584120000001', 'Cliente Uno') returning id into cli1;
  insert into public.clientes (negocio_id, telefono, nombre) values (otro, '584120000009', 'Cliente Ajeno') returning id into clix;
  insert into public.pedidos (negocio_id, cliente_id, cliente_telefono, cliente_nombre, total_usd, tasa_bs, estado)
    values (nid, cli1, '584120000001', 'Cliente Uno', 10, 50, 'nuevo') returning id into ped1;
  insert into public.pedido_items (pedido_id, negocio_id, producto_id, nombre_producto, cantidad, precio_unitario_usd) values (ped1, nid, canilla, 'Pan canilla', 2, 0.5);
  insert into public.pedidos (negocio_id, cliente_id, cliente_telefono, cliente_nombre, total_usd, tasa_bs, estado, created_at)
    values (nid, cli1, '584120000001', 'Cliente Uno', 20, 50, 'entregado', '2026-01-15 12:00:00+00') returning id into ped2;
  insert into public.pedidos (negocio_id, cliente_id, cliente_telefono, cliente_nombre, total_usd, tasa_bs, estado)
    values (otro, clix, '584120000009', 'Cliente Ajeno', 7, 50, 'nuevo') returning id into pedx;
  -- pedidos de reporte con fechas exactas (Venezuela = UTC-4): 03:30 UTC del 25 es el día 24 a las 23:30
  insert into public.pedidos (negocio_id, cliente_id, cliente_telefono, total_usd, tasa_bs, estado, created_at)
    values (nid, cli1, '584120000001', 4, 50, 'pagado', '2026-09-25 03:30:00+00') returning id into ped_r;
  insert into public.pedido_items (pedido_id, negocio_id, producto_id, nombre_producto, cantidad, precio_unitario_usd) values (ped_r, nid, canilla, 'Pan canilla', 3, 1), (ped_r, nid, sobado, 'Pan sobado', 1, 1);
  insert into public.pedidos (negocio_id, cliente_id, cliente_telefono, total_usd, tasa_bs, estado, created_at)
    values (nid, cli1, '584120000001', 6, 50, 'confirmado', '2026-09-25 04:30:00+00') returning id into ped_r;
  insert into public.pedido_items (pedido_id, negocio_id, producto_id, nombre_producto, cantidad, precio_unitario_usd) values (ped_r, nid, canilla, 'Pan canilla', 2, 3);
  insert into public.pedidos (negocio_id, cliente_id, cliente_telefono, total_usd, tasa_bs, estado, created_at)
    values (nid, cli1, '584120000001', 100, 50, 'nuevo', '2026-09-25 05:00:00+00'), (nid, cli1, '584120000001', 100, 50, 'cancelado', '2026-09-25 06:00:00+00');

  toks := array[':nid', nid::text, ':otro', otro::text, ':canilla_id', canilla::text, ':c1', c1, ':c2', c2, ':c3', c3, ':cz', cz,
                ':ped1', ped1::text, ':ped2', ped2::text, ':pedx', pedx::text, ':bebidas', cat_bebidas::text];

  for t in select * from (values
    -- ==================== 1) EL PÚBLICO NO VE stock, pedidos, clientes ni instancias
    ('anon','anon: leer stock',                          'select stock from public.productos', 'error'),
    ('anon','anon: select * de productos',               'select * from public.productos', 'error'),
    ('anon','anon: columnas públicas de productos',      'select id, nombre, precio_usd, disponible, foto_url from public.productos', 'rows=17'),
    ('anon','anon: actualizar stock',                    'update public.productos set stock = 999', 'error'),
    ('anon','anon: leer instancia de Evolution',         'select evolution_instance_name from public.negocios', 'error'),
    ('anon','anon: leer pedidos',                        'select * from public.pedidos', 'error'),
    ('anon','anon: leer pedido_items',                   'select * from public.pedido_items', 'error'),
    ('anon','anon: leer clientes',                       'select * from public.clientes', 'error'),
    ('anon','anon: insertar pedido',                     'insert into public.pedidos (negocio_id, cliente_telefono, total_usd) values ('':nid'', ''584120000003'', 1)', 'error'),
    ('anon','anon: llamar crear_pedido',                 'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000003'', ''X'', ''[]''::jsonb)', 'error'),
    -- ==================== 2) categorías desactivadas: el público no las ve, ni sus productos
    ('postgres','(preparación) desactivar Bebidas',      'update public.categorias set activa = false where id = '':bebidas''', 'rows=1'),
    ('anon','anon: categorías visibles (3 de 4)',        'select id from public.categorias', 'rows=3'),
    ('anon','anon: productos visibles (sin los de Bebidas)', 'select id from public.productos', 'rows=13'),
    ('own','dueño: SÍ ve su categoría desactivada',      'select id from public.categorias where negocio_id = '':nid''', 'rows=4'),
    ('own','dueño: SÍ ve sus productos de esa categoría','select id from public.productos where negocio_id = '':nid''', 'rows=16'),
    ('postgres','(preparación) reactivar Bebidas',       'update public.categorias set activa = true where id = '':bebidas''', 'rows=1'),
    -- ==================== 3) EL DUEÑO: lo suyo sí, lo ajeno no
    ('own','dueño: leer stock propio',                   'select stock from public.productos where negocio_id = '':nid''', 'rows=16'),
    ('own','dueño: leer stock de OTRO local',            'select stock from public.productos where negocio_id = '':otro''', 'rows=0'),
    ('own','dueño: leer el catálogo público de otro (ya no)', 'select id from public.productos where id <> all(array(select id from public.productos where negocio_id = '':nid''))', 'rows=0'),
    ('own','dueño: actualizar SU stock',                 'update public.productos set stock = 6 where id = '':canilla_id''', 'rows=1'),
    ('own','dueño: actualizar stock AJENO',              'update public.productos set stock = 1 where negocio_id = '':otro''', 'rows=0'),
    ('own','dueño: crear producto con stock',            'insert into public.productos (negocio_id, nombre, precio_usd, stock) values ('':nid'', ''Nuevo con stock'', 1, 4)', 'rows=1'),
    ('own','dueño: stock negativo',                      'update public.productos set stock = -1 where id = '':canilla_id''', 'error'),
    ('own','dueño: leer sus pedidos',                    'select id from public.pedidos', 'rows=6'),
    ('own','dueño: pedidos de OTRO local',               'select id from public.pedidos where negocio_id = '':otro''', 'rows=0'),
    ('own','dueño: leer sus items',                      'select id from public.pedido_items', 'rows=4'),
    ('own','dueño: leer sus clientes',                   'select id from public.clientes', 'rows=1'),
    ('own','dueño: insertar pedido',                     'insert into public.pedidos (negocio_id, cliente_telefono, total_usd) values ('':nid'', ''584120000003'', 1)', 'error'),
    ('own','dueño: editar el total de un pedido',        'update public.pedidos set total_usd = 0 where id = '':ped1''', 'error'),
    ('own','dueño: borrar un pedido',                    'delete from public.pedidos where id = '':ped1''', 'error'),
    ('own','dueño: editar un cliente',                   'update public.clientes set nombre = ''x''', 'error'),
    ('own','dueño: leer instancia por la tabla',         'select evolution_instance_name from public.negocios', 'error'),
    ('own','dueño: su instancia por la función',         'select public.mi_instancia_evolution()', 'val=menu-nueva-victoria'),
    ('own','dueño: instancia de OTRO local',             'select public.instancia_evolution_de('':otro'')', 'error'),
    ('own','dueño: fijar instancia',                     'select public.fijar_instancia_evolution('':nid'', ''robada'')', 'error'),
    ('own','dueño: llamar crear_pedido',                 'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000003'', ''X'', ''[]''::jsonb)', 'error'),
    ('own2','otro dueño: solo ve sus pedidos',           'select id from public.pedidos', 'rows=1'),
    ('own2','otro dueño: ventas de MI local',            'select * from public.ventas_por_periodo('':nid'', ''2026-01-01'', ''2026-12-31'', ''day'')', 'rows=0'),
    ('own2','otro dueño: más vendidos de MI local',      'select * from public.productos_mas_vendidos('':nid'', ''2026-01-01'', ''2026-12-31'')', 'rows=0'),
    ('own2','otro dueño: clientes de MI local',          'select * from public.clientes_resumen('':nid'')', 'rows=0'),
    ('sa','super admin: ve todos los pedidos',           'select id from public.pedidos', 'rows=7'),
    ('sa','super admin: instancia de un local',          'select public.instancia_evolution_de('':otro'')', 'val=menu-zz-ajeno'),
    ('sa','super admin: listar_negocios trae la instancia', 'select instancia from public.listar_negocios() where slug = ''nueva-victoria''', 'val=menu-nueva-victoria'),
    ('sa','super admin: fijar instancia repetida',       'select public.fijar_instancia_evolution('':nid'', ''menu-zz-ajeno'')', 'error'),
    ('sa','super admin: fijar instancia con formato malo','select public.fijar_instancia_evolution('':nid'', ''Mala Instancia!'')', 'error'),
    -- ==================== 4) stock -> disponible (trigger)
    ('own','stock a 0 -> agotado solo',                  'update public.productos set stock = 0 where id = '':canilla_id'' returning disponible', 'val=false'),
    ('own','reponer stock -> disponible otra vez',       'update public.productos set stock = 10 where id = '':canilla_id'' returning disponible', 'val=true'),
    ('own','pausar a mano un producto con stock',        'update public.productos set disponible = false where id = '':canilla_id'' returning disponible', 'val=false'),
    ('own','descontar NO reactiva lo pausado a mano',    'update public.productos set stock = 9 where id = '':canilla_id'' returning disponible', 'val=false'),
    ('own','volver a dejarlo disponible',                'update public.productos set disponible = true, stock = 5 where id = '':canilla_id'' returning disponible', 'val=true'),
    -- ==================== 5) EL AGENTE: crear_pedido
    ('service_role','agente: instancia desconocida',     'select public.crear_pedido(''no-existe'', ''nueva-victoria'', ''584120000003'', ''Ana'', ''[{"codigo":":c1","cantidad":1}]''::jsonb)->>''error''', 'val=negocio_no_encontrado'),
    ('service_role','agente: slug del mensaje distinto (mensaje manipulado)', 'select public.crear_pedido(''menu-nueva-victoria'', ''zz-ajeno'', ''584120000003'', ''Ana'', ''[{"codigo":":c1","cantidad":1}]''::jsonb)->>''error''', 'val=slug_no_coincide'),
    ('service_role','agente: teléfono inválido',         'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''123'', ''Ana'', ''[{"codigo":":c1","cantidad":1}]''::jsonb)->>''error''', 'val=telefono_invalido'),
    ('service_role','agente: sin items',                 'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000003'', ''Ana'', ''[]''::jsonb)->>''error''', 'val=items_invalidos'),
    ('service_role','agente: cantidad 0',                'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000003'', ''Ana'', ''[{"codigo":":c1","cantidad":0}]''::jsonb)->>''error''', 'val=items_invalidos'),
    ('service_role','agente: cantidad negativa',         'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000003'', ''Ana'', ''[{"codigo":":c1","cantidad":-2}]''::jsonb)->>''error''', 'val=items_invalidos'),
    ('service_role','agente: código mal formado',        'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000003'', ''Ana'', ''[{"codigo":"zzzz","cantidad":1}]''::jsonb)->>''error''', 'val=items_invalidos'),
    ('service_role','agente: 1000 unidades',             'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000003'', ''Ana'', ''[{"codigo":":c1","cantidad":1000}]''::jsonb)->>''error''', 'val=items_invalidos'),
    ('service_role','agente: domicilio sin dirección',   'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000003'', ''Ana'', ''[{"codigo":":c1","cantidad":1}]''::jsonb, null, ''domicilio'')->>''error''', 'val=direccion_requerida'),
    ('service_role','agente: producto de OTRO local (por código)', 'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000003'', ''Ana'', ''[{"codigo":":cz","cantidad":1}]''::jsonb)->>''error''', 'val=producto_no_encontrado'),
    ('service_role','agente: más que el stock',          'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000003'', ''Ana'', ''[{"codigo":":c1","cantidad":6}]''::jsonb)->>''error''', 'val=stock_insuficiente'),
    ('postgres','el stock NO cambió tras el rechazo',    'select stock::text from public.productos where id = '':canilla_id''', 'val=5'),
    ('service_role','agente: pedido correcto (2 canillas + 1 sobado)', 'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''+58 412-000-0003'', ''  Ana  '', ''[{"codigo":":c1","cantidad":2},{"codigo":":c2","cantidad":1}]''::jsonb, ''pago_movil'', ''retiro'', null, ''sin azúcar'', ''wamid-1'')->>''total_usd''', 'val=1.30'),
    ('postgres','el stock bajó a 3',                     'select stock::text from public.productos where id = '':canilla_id''', 'val=3'),
    ('service_role','agente: MISMO mensaje otra vez (duplicado)', 'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000003'', ''Ana'', ''[{"codigo":":c1","cantidad":2}]''::jsonb, null, ''retiro'', null, null, ''wamid-1'')->>''duplicado''', 'val=true'),
    ('postgres','el duplicado NO descontó stock',        'select stock::text from public.productos where id = '':canilla_id''', 'val=3'),
    ('postgres','un solo pedido para wamid-1',           'select count(*)::text from public.pedidos where origen_mensaje_id = ''wamid-1''', 'val=1'),
    ('postgres','cliente creado con el teléfono normalizado y sin espacios en el nombre', 'select nombre from public.clientes where telefono = ''584120000003'' and negocio_id = '':nid''', 'val=Ana'),
    ('service_role','agente: segundo pedido del mismo cliente', 'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000003'', ''Ana María'', ''[{"codigo":":c3","cantidad":1}]''::jsonb, null, ''retiro'', null, null, ''wamid-2'')->>''ok''', 'val=true'),
    ('postgres','sigue siendo UN cliente con 2 pedidos', 'select count(*)::text || ''/'' || (select count(*) from public.pedidos where cliente_telefono = ''584120000003'')::text from public.clientes where telefono = ''584120000003'' and negocio_id = '':nid''', 'val=1/2'),
    ('postgres','el nombre se actualizó',                'select nombre from public.clientes where telefono = ''584120000003'' and negocio_id = '':nid''', 'val=Ana María'),
    ('postgres','el pedido guarda la tasa del momento',  'select tasa_bs::text from public.pedidos where origen_mensaje_id = ''wamid-1''', 'val=50.0000'),
    ('postgres','y la foto de nombre y precio del item', 'select nombre_producto || ''@'' || precio_unitario_usd::text from public.pedido_items i join public.pedidos p on p.id = i.pedido_id where p.origen_mensaje_id = ''wamid-1'' and i.producto_id = '':canilla_id''', 'val=Pan canilla@0.50'),
    ('postgres','(preparación) cambiar el precio después', 'update public.productos set precio_usd = 99, nombre = ''Renombrado'' where id = '':canilla_id''', 'rows=1'),
    ('postgres','el item conserva el nombre y precio de entonces', 'select nombre_producto || ''@'' || precio_unitario_usd::text from public.pedido_items i join public.pedidos p on p.id = i.pedido_id where p.origen_mensaje_id = ''wamid-1'' and i.producto_id = '':canilla_id''', 'val=Pan canilla@0.50'),
    ('postgres','(preparación) producto agotado a mano', 'update public.productos set disponible = false where id = '':canilla_id''', 'rows=1'),
    ('service_role','agente: producto agotado',          'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000004'', ''Luis'', ''[{"codigo":":c1","cantidad":1}]''::jsonb)->>''error''', 'val=producto_no_disponible'),
    ('postgres','(preparación) categoría desactivada',   'update public.categorias set activa = false where id = (select categoria_id from public.productos where id = '':canilla_id'')', 'rows=1'),
    ('postgres','(preparación) canilla disponible otra vez', 'update public.productos set disponible = true where id = '':canilla_id''', 'rows=1'),
    ('service_role','agente: producto de categoría desactivada', 'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000004'', ''Luis'', ''[{"codigo":":c1","cantidad":1}]''::jsonb)->>''error''', 'val=producto_no_disponible'),
    ('postgres','(preparación) pausar el local (impago)', 'update public.negocios set activo = false where id = '':nid''', 'rows=1'),
    ('service_role','agente: local pausado',             'select public.crear_pedido(''menu-nueva-victoria'', ''nueva-victoria'', ''584120000004'', ''Luis'', ''[{"codigo":":c2","cantidad":1}]''::jsonb)->>''error''', 'val=negocio_pausado'),
    ('own','PAUSADO: el dueño no puede cambiar estados', 'select public.cambiar_estado_pedido('':ped1'', ''confirmado'')', 'error'),
    ('sa','PAUSADO: el super admin sí',                  'select public.cambiar_estado_pedido('':ped1'', ''confirmado'')', 'val=confirmado'),
    ('postgres','(preparación) reactivar el local',      'update public.negocios set activo = true where id = '':nid''', 'rows=1'),
    -- ==================== 6) ESTADOS de pedido
    ('own','dueño: confirmado -> pagado',                'select public.cambiar_estado_pedido('':ped1'', ''pagado'')', 'val=pagado'),
    ('own','dueño: pagado -> nuevo (no permitido)',      'select public.cambiar_estado_pedido('':ped1'', ''nuevo'')', 'error'),
    ('own','dueño: estado inventado',                    'select public.cambiar_estado_pedido('':ped1'', ''regalado'')', 'error'),
    ('own2','otro dueño: cambiar estado de MI pedido',   'select public.cambiar_estado_pedido('':ped1'', ''entregado'')', 'error'),
    ('own','dueño: cambiar estado de pedido AJENO',      'select public.cambiar_estado_pedido('':pedx'', ''confirmado'')', 'error'),
    ('own','dueño: entregado es final (cancelar no)',    'select public.cambiar_estado_pedido('':ped2'', ''cancelado'')', 'error'),
    ('own','dueño: pedido inexistente',                  'select public.cambiar_estado_pedido(gen_random_uuid(), ''pagado'')', 'error'),
    ('postgres','(preparación) stock de canilla = 10',   'update public.productos set stock = 10 where id = '':canilla_id''', 'rows=1'),
    ('own','dueño: CANCELAR devuelve el stock (2 canillas)', 'select public.cambiar_estado_pedido('':ped1'', ''cancelado'')', 'val=cancelado'),
    ('postgres','el stock volvió a 12',                  'select stock::text from public.productos where id = '':canilla_id''', 'val=12'),
    ('own','dueño: cancelado es final',                  'select public.cambiar_estado_pedido('':ped1'', ''pagado'')', 'error'),
    -- ==================== 7) REPORTES (días en hora de Venezuela; solo ventas confirmadas/pagadas/entregadas)
    ('own','ventas: 2 días con ventas',                  'select * from public.ventas_por_periodo('':nid'', ''2026-09-24'', ''2026-09-25'', ''day'')', 'rows=2'),
    ('own','ventas: total = 4 + 6 (nuevo y cancelado NO cuentan)', 'select sum(total_usd)::text from public.ventas_por_periodo('':nid'', ''2026-09-24'', ''2026-09-25'', ''day'')', 'val=10.00'),
    ('own','ventas: 03:30 UTC del 25 cuenta como día 24 en Caracas', 'select min(periodo)::text from public.ventas_por_periodo('':nid'', ''2026-09-24'', ''2026-09-25'', ''day'')', 'val=2026-09-24'),
    ('own','ventas: agrupadas por mes = 1 fila',         'select * from public.ventas_por_periodo('':nid'', ''2026-09-01'', ''2026-09-30'', ''month'')', 'rows=1'),
    ('own','ventas: grano inválido no rompe',            'select * from public.ventas_por_periodo('':nid'', ''2026-09-24'', ''2026-09-25'', ''año; drop table x'')', 'rows=2'),
    ('own','ventas: total en Bs con la tasa de entonces','select total_bs::text from public.ventas_por_periodo('':nid'', ''2026-09-24'', ''2026-09-24'', ''day'')', 'val=200.000000'),
    ('own','más vendidos: la canilla suma 5 (3 + 2)',    'select unidades::text from public.productos_mas_vendidos('':nid'', ''2026-09-24'', ''2026-09-25'') where nombre = ''Pan canilla''', 'val=5'),
    ('own','más vendidos: el primero es la canilla',     'select nombre from public.productos_mas_vendidos('':nid'', ''2026-09-24'', ''2026-09-25'') limit 1', 'val=Pan canilla'),
    ('own','clientes: resumen con pedidos y total',      'select pedidos::text || ''/'' || total_usd::text from public.clientes_resumen('':nid'') where telefono = ''584120000001''', 'val=4/30.00'),
    ('sa','super admin: ventas de cualquier local',      'select * from public.ventas_por_periodo('':nid'', ''2026-09-24'', ''2026-09-25'', ''day'')', 'rows=2')
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
    begin
      if t.esperado like 'val=%' then
        execute sent into txt;
        obtenido := 'val=' || coalesce(txt, 'NULL'); detalle := '';
      else
        execute sent;
        get diagnostics n = row_count;
        obtenido := 'rows=' || n; detalle := '';
      end if;
    exception when others then
      obtenido := 'error'; detalle := ' [' || left(sqlerrm, 60) || ']';
    end;
    if obtenido <> t.esperado then fallos := fallos + 1; end if;
    r := r || case when obtenido = t.esperado then 'OK    ' else 'FALLA ' end
           || rpad(t.nombre, 64) || ' esperado ' || rpad(t.esperado, 24) || ' obtenido ' || obtenido || detalle || E'\n';
  end loop;

  -- ==================== 8) ROLLBACK: un pedido que falla a mitad NO deja el stock descontado
  execute 'reset role';
  update public.productos set stock = 10, disponible = true where id in (canilla, integral);
  update public.categorias set activa = true where negocio_id = nid;
  select coalesce(sum(stock), 0) into base_stock from public.productos where negocio_id = nid;
  execute 'set local role service_role';
  txt := (public.crear_pedido('menu-nueva-victoria', 'nueva-victoria', '584120000005', 'Rosa',
          jsonb_build_array(jsonb_build_object('codigo', c3, 'cantidad', 2), jsonb_build_object('codigo', c1, 'cantidad', 99)),
          null, 'retiro', null, null, 'wamid-rollback'))->>'error';
  execute 'reset role';
  total := total + 1;
  if txt = 'stock_insuficiente' and (select coalesce(sum(stock), 0) from public.productos where negocio_id = nid) = base_stock
     and not exists (select 1 from public.pedidos where origen_mensaje_id = 'wamid-rollback') then
    r := r || 'OK    ' || rpad('un pedido que falla a mitad no deja stock descontado ni pedido', 64) || E'\n';
  else
    fallos := fallos + 1;
    r := r || 'FALLA ' || rpad('rollback de pedido fallido a mitad', 64) || ' error=' || coalesce(txt, 'NULL') || E'\n';
  end if;

  raise exception E'RESULTADOS\n%\n% de % pruebas correctas', r, total - fallos, total;
end
$$;
