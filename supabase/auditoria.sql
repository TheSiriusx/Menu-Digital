-- auditoria.sql — Auditoría de seguridad de la base de datos (solo lectura).
-- Se pega en Supabase → SQL Editor. Cada fila que empiece por PROBLEMA es algo que revisar:
-- si no sale ninguna, la comprobación pasó. Las filas INFO son solo datos de contexto.
-- Conviene correrla después de cada migración.

-- 1) Tablas de public sin RLS (cualquiera con la clave pública podría leer o escribir según sus permisos).
select 'PROBLEMA: tabla sin RLS' as comprobacion, format('%I.%I', n.nspname, c.relname) as detalle
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

union all
-- 2) Funciones security definer sin search_path fijo: podrían suplantarse con objetos de otro esquema.
select 'PROBLEMA: función security definer sin search_path fijo', p.oid::regprocedure::text
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')

union all
-- 3) Funciones security definer que la clave pública (anon) puede ejecutar.
select 'PROBLEMA: función security definer ejecutable sin sesión (anon)', p.oid::regprocedure::text
from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')

union all
-- 4) anon con permisos de escritura, a nivel de tabla.
select 'PROBLEMA: anon con permiso de escritura en tabla', format('%s (%s)', table_name, privilege_type)
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
  and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'TRIGGER', 'REFERENCES')

union all
-- 5) anon con permisos de escritura, a nivel de columna.
select 'PROBLEMA: anon con permiso de escritura en columna', format('%s.%s (%s)', table_name, column_name, privilege_type)
from information_schema.column_privileges
where grantee = 'anon' and table_schema = 'public' and privilege_type in ('INSERT', 'UPDATE')

union all
-- 6) authenticated con permisos peligrosos que no usa la aplicación.
select 'PROBLEMA: authenticated con TRUNCATE, TRIGGER o REFERENCES', format('%s (%s)', table_name, privilege_type)
from information_schema.role_table_grants
where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')

union all
-- 7) Políticas de escritura abiertas (using/with check = true).
select 'PROBLEMA: política de escritura abierta a todos', format('%s.%s (%s)', tablename, policyname, cmd)
from pg_policies
where schemaname in ('public', 'storage') and cmd <> 'SELECT' and (qual = 'true' or with_check = 'true')

union all
-- 8) Buckets públicos sin límite de tamaño, sin lista de tipos, o que aceptan SVG (puede llevar scripts).
select 'PROBLEMA: bucket público sin límites o que acepta SVG', id
from storage.buckets
where public and (file_size_limit is null or allowed_mime_types is null or 'image/svg+xml' = any(allowed_mime_types))

union all
-- 9) Super admins sin segundo factor verificado (deberían ser 0 una vez activada la migración 0006).
select 'AVISO: super admin sin segundo factor verificado', u.email
from public.perfiles p join auth.users u on u.id = p.id
where p.rol = 'superadmin'
  and not exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified')

union all
-- 10) Cuentas sin perfil (no pueden hacer nada, pero conviene saberlo).
select 'AVISO: cuenta sin perfil', u.email
from auth.users u where not exists (select 1 from public.perfiles p where p.id = u.id)

union all
select 'INFO: tablas de public con RLS', count(*)::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity

union all
select 'INFO: políticas en public y storage', count(*)::text
from pg_policies where schemaname in ('public', 'storage')

union all
select 'INFO: funciones security definer en public', count(*)::text
from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef

union all
select 'INFO: super admins / dueños', format('%s / %s', count(*) filter (where rol = 'superadmin'), count(*) filter (where rol = 'dueno'))
from public.perfiles

order by 1, 2;
