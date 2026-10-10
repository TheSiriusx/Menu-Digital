-- 0015_crear_dueno.sql
-- El super admin crea la cuenta del dueño desde la app (antes había que crearla a mano en Supabase →
-- Authentication y luego «Vincular dueño»). La web no tiene la clave de servicio, a propósito: por eso la cuenta
-- la crea esta función security definer, que solo puede usar el super admin (es_superadmin(), que además exige
-- el segundo factor). La contraseña temporal la genera el servidor de la app y se le muestra una sola vez al
-- super admin; el dueño la cambia en su panel (Configuración → Cambiar contraseña) o con «¿Olvidaste tu contraseña?».
-- Si ya existe una cuenta con ese correo no se toca su contraseña: solo se vincula, igual que vincular_dueno.
--
-- Se aplica pegándola en Supabase → SQL Editor.

begin;

create or replace function public.crear_dueno(p_correo text, p_clave text, p_negocio uuid)
returns text   -- 'creada' | 'vinculada'
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  correo  text := lower(trim(coalesce(p_correo, '')));
  usuario uuid;
begin
  if not (select public.es_superadmin()) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if char_length(correo) > 254 or correo !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Escribe un correo válido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.negocios where id = p_negocio) then
    raise exception 'Local no encontrado' using errcode = 'P0002';
  end if;

  -- Cuenta existente: solo se vincula (vincular_dueno valida que no sea de super admin).
  if exists (select 1 from auth.users where lower(email) = correo) then
    perform public.vincular_dueno(correo, p_negocio);
    return 'vinculada';
  end if;

  if char_length(coalesce(p_clave, '')) not between 10 and 72 then
    raise exception 'Contraseña temporal no válida.' using errcode = '22023';
  end if;

  usuario := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', usuario, 'authenticated', 'authenticated', correo,
    extensions.crypt(p_clave, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), usuario, usuario::text, jsonb_build_object('sub', usuario::text, 'email', correo, 'email_verified', true),
    'email', null, now(), now());

  insert into public.perfiles (id, negocio_id, rol) values (usuario, p_negocio, 'dueno');
  return 'creada';
end
$$;

-- Supabase da EXECUTE a anon y authenticated en funciones nuevas: solo la usa el super admin (con sesión).
revoke all on function public.crear_dueno(text, text, uuid) from public, anon, authenticated;
grant execute on function public.crear_dueno(text, text, uuid) to authenticated;

commit;
