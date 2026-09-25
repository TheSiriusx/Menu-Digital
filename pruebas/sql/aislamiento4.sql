do $$
declare
  sa uuid := gen_random_uuid(); own uuid := gen_random_uuid(); own2 uuid := gen_random_uuid();
  nid uuid; otro uuid; cat_otro uuid; prod_otro uuid;
  r text := ''; t record; n bigint; obtenido text; detalle text; fallos int := 0; total int := 0;
begin
  select id into nid from public.negocios where slug = 'nueva-victoria';
  insert into auth.users (id, email) values (sa, 'sa@x.test'), (own, 'own@x.test'), (own2, 'own2@x.test');
  insert into public.perfiles (id, negocio_id, rol) values (sa, null, 'superadmin'), (own, nid, 'dueno');
  insert into public.negocios (slug, nombre) values ('zz-ajeno', 'Ajeno') returning id into otro;
  insert into public.categorias (negocio_id, nombre) values (otro, 'cat ajena') returning id into cat_otro;
  insert into public.productos (negocio_id, nombre, precio_usd) values (otro, 'prod ajeno', 1) returning id into prod_otro;

  for t in select * from (values
    -- ============ super admin
    ('sa','sa: es_superadmin()',                       'select 1 where public.es_superadmin()', 'rows=1'),
    ('sa','sa: listar_negocios (ve todos)',            'select * from public.listar_negocios()', 'rows=2'),
    ('sa','sa: crear local válido',                    'select public.crear_negocio(''zz-nuevo'', ''Nuevo'', ''panaderia'', ''basico'')', 'rows=1'),
    ('sa','sa: crear con slug reservado (admin)',      'select public.crear_negocio(''admin'', ''X'', ''panaderia'', ''basico'')', 'error'),
    ('sa','sa: crear con slug inválido',               'select public.crear_negocio(''Mal Slug'', ''X'', ''panaderia'', ''basico'')', 'error'),
    ('sa','sa: crear con slug repetido',               'select public.crear_negocio(''zz-ajeno'', ''X'', ''panaderia'', ''basico'')', 'error'),
    ('sa','sa: crear con plan inválido',               'select public.crear_negocio(''zz-otro'', ''X'', ''panaderia'', ''gratis'')', 'error'),
    ('sa','sa: pausar un local',                       'select public.cambiar_estado_negocio('':otro'', false)', 'rows=1'),
    ('sa','sa: cambiar plan a pro',                    'select public.cambiar_plan_negocio('':otro'', ''pro'')', 'rows=1'),
    ('sa','sa: cambiar plan inválido',                 'select public.cambiar_plan_negocio('':otro'', ''vip'')', 'error'),
    ('sa','sa: pausar local inexistente',              'select public.cambiar_estado_negocio(gen_random_uuid(), false)', 'error'),
    ('sa','sa: vincular dueño',                        'select public.vincular_dueno(''OWN2@x.test'', '':otro'')', 'rows=1'),
    ('sa','sa: vincular correo inexistente',           'select public.vincular_dueno(''nadie@x.test'', '':otro'')', 'error'),
    ('sa','sa: vincular a otro super admin',           'select public.vincular_dueno(''sa@x.test'', '':otro'')', 'error'),
    ('sa','sa: quitar dueño',                          'select public.quitar_dueno(''own2@x.test'', '':otro'')', 'rows=1'),
    ('sa','sa: editar producto de local PAUSADO',      'update public.productos set precio_usd = 5 where id = '':prod_otro''', 'rows=1'),
    ('sa','sa: crear categoría en local pausado',      'insert into public.categorias (negocio_id, nombre) values ('':otro'', ''nueva'')', 'rows=1'),
    ('sa','sa: borrar producto de otro local',         'delete from public.productos where id = '':prod_otro''', 'rows=1'),
    ('sa','sa: editar tasa de un local',               'update public.negocios set tasa_bs = 7 where id = '':otro''', 'rows=1'),
    ('sa','sa: leer catálogo de local pausado',        'select 1 from public.categorias where negocio_id = '':otro''', 'rows=2'),
    ('sa','sa: update directo de activo',              'update public.negocios set activo = true where id = '':otro''', 'error'),
    ('sa','sa: update directo de plan',                'update public.negocios set plan = ''pro'' where id = '':otro''', 'error'),
    ('sa','sa: update directo de slug',                'update public.negocios set slug = ''robado'' where id = '':otro''', 'error'),
    -- ============ dueño (local ACTIVO)
    ('own','dueño: es_superadmin() es falso',          'select 1 where public.es_superadmin()', 'rows=0'),
    ('own','dueño: listar_negocios',                   'select * from public.listar_negocios()', 'error'),
    ('own','dueño: crear_negocio',                     'select public.crear_negocio(''zz-hack'', ''X'', ''panaderia'', ''pro'')', 'error'),
    ('own','dueño: pausar OTRO local',                 'select public.cambiar_estado_negocio('':otro'', false)', 'error'),
    ('own','dueño: cambiar su propio plan',            'select public.cambiar_plan_negocio('':nid'', ''pro'')', 'error'),
    ('own','dueño: vincularse a otro local',           'select public.vincular_dueno(''own@x.test'', '':otro'')', 'error'),
    ('own','dueño: quitar dueños',                     'select public.quitar_dueno(''own@x.test'', '':nid'')', 'error'),
    ('own','dueño: editar SU tasa (activo)',           'update public.negocios set tasa_bs = 61 where id = '':nid''', 'rows=1'),
    ('own','dueño: editar producto AJENO',             'insert into public.productos (negocio_id, nombre, precio_usd) values ('':otro'', ''x'', 1)', 'error'),
    -- ============ se pausa Nueva Victoria (impago)
    ('postgres','(preparación) pausar Nueva Victoria', 'update public.negocios set activo = false where id = '':nid''', 'rows=1'),
    ('own','PAUSADO dueño: leer sus productos',        'select 1 from public.productos where negocio_id = '':nid''', 'rows=16'),
    ('own','PAUSADO dueño: leer sus categorías',       'select 1 from public.categorias where negocio_id = '':nid''', 'rows=4'),
    ('own','PAUSADO dueño: cambiar precio',            'update public.productos set precio_usd = 9 where negocio_id = '':nid''', 'rows=0'),
    ('own','PAUSADO dueño: marcar agotado',            'update public.productos set disponible = false where negocio_id = '':nid''', 'rows=0'),
    ('own','PAUSADO dueño: crear producto',            'insert into public.productos (negocio_id, nombre, precio_usd) values ('':nid'', ''x'', 1)', 'error'),
    ('own','PAUSADO dueño: borrar producto',           'delete from public.productos where negocio_id = '':nid''', 'rows=0'),
    ('own','PAUSADO dueño: crear categoría',           'insert into public.categorias (negocio_id, nombre) values ('':nid'', ''x'')', 'error'),
    ('own','PAUSADO dueño: renombrar categoría',       'update public.categorias set nombre = ''x'' where negocio_id = '':nid''', 'rows=0'),
    ('own','PAUSADO dueño: cambiar tasa/ajustes',      'update public.negocios set tasa_bs = 99 where id = '':nid''', 'rows=0'),
    ('own','PAUSADO dueño: reactivarse solo',          'update public.negocios set activo = true where id = '':nid''', 'error'),
    ('sa','PAUSADO super admin: editar su catálogo',   'update public.productos set precio_usd = 3 where negocio_id = '':nid''', 'rows=16'),
    ('sa','PAUSADO super admin: reactivar por función','select public.cambiar_estado_negocio('':nid'', true)', 'rows=1'),
    ('own','REACTIVADO dueño: puede editar otra vez',  'update public.productos set precio_usd = 4 where negocio_id = '':nid''', 'rows=16'),
    -- ============ sin sesión
    ('anon','anon: es_superadmin()',                   'select public.es_superadmin()', 'error'),
    ('anon','anon: listar_negocios',                   'select * from public.listar_negocios()', 'error'),
    ('anon','anon: crear_negocio',                     'select public.crear_negocio(''zz-anon'', ''X'', ''panaderia'', ''pro'')', 'error'),
    ('anon','anon: cambiar_estado_negocio',            'select public.cambiar_estado_negocio('':nid'', true)', 'error'),
    ('anon','anon: vincular_dueno',                    'select public.vincular_dueno(''own2@x.test'', '':nid'')', 'error'),
    ('anon','anon: menú público de Nueva Victoria (activo)', 'select 1 from public.productos where negocio_id = '':nid''', 'rows=16')
  ) as v(quien, nombre, sentencia, esperado) loop
    total := total + 1;
    execute 'reset role';
    if t.quien = 'anon' then
      execute 'set local role anon';
    elsif t.quien <> 'postgres' then
      perform set_config('request.jwt.claims', json_build_object('sub', case t.quien when 'sa' then sa when 'own' then own else own2 end, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
    end if;
    begin
      execute replace(replace(replace(replace(t.sentencia, ':nid', nid::text), ':otro', otro::text), ':cat_otro', cat_otro::text), ':prod_otro', prod_otro::text);
      get diagnostics n = row_count;
      obtenido := 'rows=' || n; detalle := '';
    exception when others then
      obtenido := 'error'; detalle := ' [' || left(sqlerrm, 55) || ']';
    end;
    if obtenido <> t.esperado then fallos := fallos + 1; end if;
    r := r || case when obtenido = t.esperado then 'OK    ' else 'FALLA ' end
           || rpad(t.nombre, 50) || ' esperado ' || rpad(t.esperado, 8) || ' obtenido ' || obtenido || detalle || E'\n';
  end loop;

  execute 'reset role';
  raise exception E'RESULTADOS\n%\n% de % pruebas correctas', r, total - fallos, total;
end
$$;
