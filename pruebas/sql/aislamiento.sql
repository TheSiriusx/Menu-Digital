do $$
declare
  uid uuid := gen_random_uuid();
  nid uuid; otro uuid; cat_otro uuid; prod_otro uuid;
  r text := ''; t record; n bigint; obtenido text; detalle text; fallos int := 0; total int := 0;
begin
  -- Preparación como superusuario (todo se revierte al final).
  select id into nid from public.negocios where slug = 'nueva-victoria';
  insert into auth.users (id, email) values (uid, 'sintetico-aislamiento@example.invalid');
  insert into public.perfiles (id, negocio_id, rol) values (uid, nid, 'dueno');
  insert into public.negocios (slug, nombre) values ('zz-ajeno', 'Ajeno') returning id into otro;
  insert into public.categorias (negocio_id, nombre) values (otro, 'cat ajena') returning id into cat_otro;
  insert into public.productos (negocio_id, nombre, precio_usd) values (otro, 'prod ajeno', 1) returning id into prod_otro;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);

  for t in select * from (values
    ('authenticated','cambiar SU tasa',                       'update public.negocios set tasa_bs = 61 where id = '':nid''', 'rows=1'),
    ('authenticated','cambiar SU nombre',                     'update public.negocios set nombre = ''Otro nombre'' where id = '':nid''', 'rows=1'),
    ('authenticated','cambiar activo (pausar/activar)',       'update public.negocios set activo = false where id = '':nid''', 'error'),
    ('authenticated','cambiar plan',                          'update public.negocios set plan = ''pro'' where id = '':nid''', 'error'),
    ('authenticated','cambiar slug',                          'update public.negocios set slug = ''robado'' where id = '':nid''', 'error'),
    ('authenticated','cambiar tipo',                          'update public.negocios set tipo = ''x'' where id = '':nid''', 'error'),
    ('authenticated','cambiar id de su negocio',              'update public.negocios set id = gen_random_uuid() where id = '':nid''', 'error'),
    ('authenticated','leer plan',                             'select plan from public.negocios', 'error'),
    ('authenticated','tasa de negocio AJENO',                 'update public.negocios set tasa_bs = 1 where id = '':otro''', 'rows=0'),
    ('authenticated','nombre de 81 caracteres',               'update public.negocios set nombre = repeat(''x'',81) where id = '':nid''', 'error'),
    ('authenticated','cambiar precio de SU producto',         'update public.productos set precio_usd = 9.99 where id = (select id from public.productos where negocio_id = '':nid'' limit 1)', 'rows=1'),
    ('authenticated','marcar SU producto agotado',            'update public.productos set disponible = false where negocio_id = '':nid''', 'rows=16'),
    ('authenticated','precio negativo',                       'update public.productos set precio_usd = -1 where negocio_id = '':nid''', 'error'),
    ('authenticated','crear producto propio',                 'insert into public.productos (negocio_id, nombre, precio_usd) values ('':nid'', ''nuevo'', 1)', 'rows=1'),
    ('authenticated','crear producto en negocio AJENO',       'insert into public.productos (negocio_id, nombre, precio_usd) values ('':otro'', ''intruso'', 1)', 'error'),
    ('authenticated','crear producto con categoría AJENA',    'insert into public.productos (negocio_id, categoria_id, nombre, precio_usd) values ('':nid'', '':cat_otro'', ''x'', 1)', 'error'),
    ('authenticated','mover SU producto a negocio AJENO',     'update public.productos set negocio_id = '':otro'' where negocio_id = '':nid''', 'error'),
    ('authenticated','editar producto AJENO',                 'update public.productos set nombre = ''hack'' where id = '':prod_otro''', 'rows=0'),
    ('authenticated','borrar producto AJENO',                 'delete from public.productos where id = '':prod_otro''', 'rows=0'),
    ('authenticated','borrar categoría AJENA',                'delete from public.categorias where id = '':cat_otro''', 'rows=0'),
    ('authenticated','crear categoría en negocio AJENO',      'insert into public.categorias (negocio_id, nombre) values ('':otro'', ''x'')', 'error'),
    ('authenticated','crear categoría propia',                'insert into public.categorias (negocio_id, nombre) values ('':nid'', ''Nueva'')', 'rows=1'),
    ('authenticated','borrar producto propio',                'delete from public.productos where negocio_id = '':nid'' and nombre = ''nuevo''', 'rows=1'),
    ('authenticated','leer perfiles (solo el suyo)',          'select 1 from public.perfiles', 'rows=1'),
    ('authenticated','crear un perfil superadmin',            'insert into public.perfiles (id, negocio_id, rol) values (gen_random_uuid(), '':otro'', ''superadmin'')', 'error'),
    ('authenticated','auto-ascenderse a superadmin',          'update public.perfiles set rol = ''superadmin''', 'error'),
    ('authenticated','ver menú público de otro (activo)',     'select 1 from public.productos where id = '':prod_otro''', 'rows=1'),
    ('anon',         'anon: actualizar negocios',             'update public.negocios set tasa_bs = 1', 'error'),
    ('anon',         'anon: insertar producto',               'insert into public.productos (negocio_id, nombre, precio_usd) values ('':nid'', ''x'', 1)', 'error'),
    ('anon',         'anon: leer perfiles',                   'select 1 from public.perfiles', 'error'),
    ('anon',         'anon: leer plan',                       'select plan from public.negocios', 'error'),
    ('anon',         'anon: llamar mi_negocio_id()',          'select public.mi_negocio_id()', 'error')
  ) as v(rol, nombre, sentencia, esperado) loop
    total := total + 1;
    execute 'reset role';
    execute format('set local role %I', t.rol);
    begin
      execute replace(replace(replace(replace(t.sentencia, ':nid', nid::text), ':otro', otro::text), ':cat_otro', cat_otro::text), ':prod_otro', prod_otro::text);
      get diagnostics n = row_count;
      obtenido := 'rows=' || n; detalle := '';
    exception when others then
      obtenido := 'error'; detalle := ' [' || left(sqlerrm, 60) || ']';
    end;
    if obtenido <> t.esperado then fallos := fallos + 1; end if;
    r := r || case when obtenido = t.esperado then 'OK    ' else 'FALLA ' end
           || rpad(t.nombre, 40) || ' esperado ' || rpad(t.esperado, 7) || ' obtenido ' || obtenido || detalle || E'\n';
  end loop;

  execute 'reset role';
  raise exception E'RESULTADOS\n%\n% de % pruebas correctas', r, total - fallos, total;
end
$$;
