"""Crea los usuarios temporales de las pruebas y los guarda en pruebas/e2e4.env y pruebas/e2e.env (permisos 600).
  SA  = super admin con TOTP ya inscrito · SA2 = super admin sin factor (para probar la inscripción)
  OWN = dueño de Nueva Victoria · OWN2 = cuenta sin perfil · E2E = otro dueño de Nueva Victoria (lo usa panel.mjs)
Se borran con limpiar.py."""
import os, secrets, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import sql
from comun import inscribir_totp

S = os.path.dirname(os.path.abspath(__file__))

def crear(sufijo):
    correo = f"e2e-{sufijo}-{secrets.token_hex(3)}@starcklabs.test"
    clave = secrets.token_urlsafe(24)
    sql(f"""
    do $$ declare uid uuid := gen_random_uuid(); begin
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        email_change_token_current, phone_change, phone_change_token, reauthentication_token)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', '{correo}',
        extensions.crypt('{clave}', extensions.gen_salt('bf')), now(),
        '{{"provider":"email","providers":["email"]}}', '{{}}', now(), now(), '', '', '', '', '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', '{correo}'), 'email', now(), now(), now());
    end $$;""")
    return correo, clave

sa, sa2, own, own2, e2e = crear("sa"), crear("sa2"), crear("dueno"), crear("dueno2"), crear("dueno")
sql(f"""
insert into public.perfiles (id, negocio_id, rol)
select id, null, 'superadmin' from auth.users where email in ('{sa[0]}', '{sa2[0]}');
insert into public.perfiles (id, negocio_id, rol)
select u.id, n.id, 'dueno' from auth.users u, public.negocios n where u.email in ('{own[0]}', '{e2e[0]}') and n.slug = 'nueva-victoria';""")

secreto, codigo_usado = inscribir_totp(sa[0], sa[1])
def escribir(nombre, texto):
    fd = os.open(f"{S}/{nombre}", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    open(fd, "w").write(texto)
escribir("e2e4.env",
    f"SA_CORREO={sa[0]}\nSA_CLAVE={sa[1]}\nOWN_CORREO={own[0]}\nOWN_CLAVE={own[1]}\nOWN2_CORREO={own2[0]}\nOWN2_CLAVE={own2[1]}\nSA2_CORREO={sa2[0]}\nSA2_CLAVE={sa2[1]}\nSA_TOTP={secreto}\nSA_TOTP_USADO={codigo_usado}\n")
escribir("e2e.env", f"E2E_CORREO={e2e[0]}\nE2E_CLAVE={e2e[1]}\n")
print("usuarios temporales creados:", [x[0] for x in (sa, sa2, own, own2, e2e)])
print(sql("select (select count(*) from auth.users) usuarios, (select count(*) from public.perfiles) perfiles")[0])
