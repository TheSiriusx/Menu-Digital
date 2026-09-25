do $$
declare
  sa uuid := gen_random_uuid(); own uuid := gen_random_uuid();
  nid uuid; otro uuid; prod uuid;
  base text := 'https://ortspggciycnybspqelq.supabase.co/storage/v1/object/public/menu-media/';
  r text := ''; t record; n bigint; obtenido text; detalle text; fallos int := 0; total int := 0;
begin
  select id into nid from public.negocios where slug = 'nueva-victoria';
  select id into prod from public.productos where negocio_id = nid limit 1;
  insert into auth.users (id, email) values (sa, 'sa@x.test'), (own, 'own@x.test');
  insert into public.perfiles (id, negocio_id, rol) values (sa, null, 'superadmin'), (own, nid, 'dueno');
  insert into public.negocios (slug, nombre) values ('zz-ajeno', 'Ajeno') returning id into otro;
  -- archivos preexistentes (como postgres)
  insert into storage.objects (bucket_id, name) values ('menu-media', nid::text || '/propio-viejo.webp'), ('menu-media', otro::text || '/ajeno.webp');

  for t in select * from (values
    ('own','dueño: subir a SU carpeta',                 'insert into storage.objects (bucket_id, name) values (''menu-media'', '':nid/nuevo.webp'')', 'rows=1'),
    ('own','dueño: subir a carpeta de OTRO local',      'insert into storage.objects (bucket_id, name) values (''menu-media'', '':otro/intruso.webp'')', 'error'),
    ('own','dueño: subir sin carpeta (raíz)',           'insert into storage.objects (bucket_id, name) values (''menu-media'', ''suelto.webp'')', 'error'),
    ('own','dueño: subir a otro bucket',                'insert into storage.objects (bucket_id, name) values (''avatars'', '':nid/x.webp'')', 'error'),
    ('own','dueño: borrar SU archivo',                  'delete from storage.objects where bucket_id = ''menu-media'' and name = '':nid/propio-viejo.webp''', 'rows=1'),
    ('own','dueño: borrar archivo AJENO',               'delete from storage.objects where bucket_id = ''menu-media'' and name = '':otro/ajeno.webp''', 'rows=0'),
    ('own','dueño: ver archivo ajeno (API)',            'select 1 from storage.objects where bucket_id = ''menu-media'' and name = '':otro/ajeno.webp''', 'rows=0'),
    ('own','dueño: foto_url propia en SU producto',     'update public.productos set foto_url = '':base:nid/a.webp'' where id = '':prod''', 'rows=1'),
    ('own','dueño: foto_url externa',                   'update public.productos set foto_url = ''https://malo.example/x.png'' where id = '':prod''', 'error'),
    ('own','dueño: foto_url de otro protocolo',         'update public.productos set foto_url = ''http://ortspggciycnybspqelq.supabase.co/storage/v1/object/public/menu-media/:nid/a.webp'' where id = '':prod''', 'error'),
    ('own','dueño: foto_url de la carpeta de OTRO local','update public.productos set foto_url = '':base:otro/a.webp'' where id = '':prod''', 'error'),
    ('own','dueño: foto_url con ruta rara (..)',        'update public.productos set foto_url = '':base:nid/../../x'' where id = '':prod''', 'error'),
    ('own','dueño: foto_url de otro bucket',            'update public.productos set foto_url = ''https://ortspggciycnybspqelq.supabase.co/storage/v1/object/public/otro/:nid/a.webp'' where id = '':prod''', 'error'),
    ('own','dueño: quitar foto (null)',                 'update public.productos set foto_url = null where id = '':prod''', 'rows=1'),
    ('own','dueño: logo_url propio',                    'update public.negocios set logo_url = '':base:nid/logo.webp'' where id = '':nid''', 'rows=1'),
    ('own','dueño: logo_url externo',                   'update public.negocios set logo_url = ''https://malo.example/l.png'' where id = '':nid''', 'error'),
    ('own','dueño: logo_url del local ajeno',           'update public.negocios set logo_url = '':base:otro/logo.webp'' where id = '':nid''', 'error'),
    ('sa','super admin: subir a cualquier local',       'insert into storage.objects (bucket_id, name) values (''menu-media'', '':otro/sa.webp'')', 'rows=1'),
    ('sa','super admin: borrar archivo ajeno',          'delete from storage.objects where bucket_id = ''menu-media'' and name = '':otro/ajeno.webp''', 'rows=1'),
    ('anon','anon: subir archivo',                      'insert into storage.objects (bucket_id, name) values (''menu-media'', '':nid/anon.webp'')', 'error'),
    ('anon','anon: borrar archivo',                     'delete from storage.objects where bucket_id = ''menu-media''', 'rows=0'),
    ('anon','anon: cambiar foto_url',                   'update public.productos set foto_url = null', 'error'),
    ('postgres','(preparación) pausar el local del dueño', 'update public.negocios set activo = false where id = '':nid''', 'rows=1'),
    ('own','PAUSADO dueño: subir a SU carpeta',         'insert into storage.objects (bucket_id, name) values (''menu-media'', '':nid/pausado.webp'')', 'error'),
    ('own','PAUSADO dueño: borrar SU archivo',          'delete from storage.objects where bucket_id = ''menu-media'' and name = '':nid/nuevo.webp''', 'rows=0'),
    ('own','PAUSADO dueño: cambiar foto_url',           'update public.productos set foto_url = '':base:nid/p.webp'' where id = '':prod''', 'rows=0'),
    ('sa','PAUSADO super admin: subir al local pausado','insert into storage.objects (bucket_id, name) values (''menu-media'', '':nid/sa-pausado.webp'')', 'rows=1')
  ) as v(quien, nombre, sentencia, esperado) loop
    total := total + 1;
    execute 'reset role';
    if t.quien = 'anon' then
      execute 'set local role anon';
    elsif t.quien <> 'postgres' then
      perform set_config('request.jwt.claims', json_build_object('sub', case t.quien when 'sa' then sa else own end, 'role', 'authenticated')::text, true);
      execute 'set local role authenticated';
    end if;
    begin
      execute replace(replace(replace(replace(t.sentencia, ':base', base), ':nid', nid::text), ':otro', otro::text), ':prod', prod::text);
      get diagnostics n = row_count;
      obtenido := 'rows=' || n; detalle := '';
    exception when others then
      obtenido := 'error'; detalle := ' [' || left(sqlerrm, 50) || ']';
    end;
    if obtenido <> t.esperado then fallos := fallos + 1; end if;
    r := r || case when obtenido = t.esperado then 'OK    ' else 'FALLA ' end
           || rpad(t.nombre, 50) || ' esperado ' || rpad(t.esperado, 7) || ' obtenido ' || obtenido || detalle || E'\n';
  end loop;

  execute 'reset role';
  raise exception E'RESULTADOS\n%\n% de % pruebas correctas', r, total - fallos, total;
end
$$;
