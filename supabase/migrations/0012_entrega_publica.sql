-- 0012_entrega_publica.sql
-- El menú público necesita saber si el local hace delivery (para no ofrecer «a domicilio» a quien solo tiene
-- retiro) y su horario (para mostrar «Abierto hasta las 7:00 pm»). Se exponen SOLO esas dos columnas al
-- público, y solo de locales activos. Nada más de agente_config (datos de pago, teléfonos, etc. siguen privados).
--
-- Además, el valor por defecto para locales NUEVOS pasa a 'cotizado' (delivery con costo a confirmar), como
-- funcionaba el menú hasta ahora. Los locales que ya existen conservan lo que tengan (lo decide el dueño).

begin;

alter table public.agente_config alter column delivery_modo set default 'cotizado';

grant select (negocio_id, delivery_modo, horario) on public.agente_config to anon;

create policy agente_config_entrega_publica
  on public.agente_config for select to anon
  using (exists (select 1 from public.negocios n where n.id = agente_config.negocio_id and n.activo));

commit;
