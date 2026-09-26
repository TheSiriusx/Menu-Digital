-- 0012_entrega_publica.sql
-- El menú público necesita saber si el local hace delivery (para no ofrecer «a domicilio» a quien solo tiene
-- retiro). Se expone SOLO esa columna al público, y solo de locales activos. Nada más de agente_config.
--
-- Además, el valor por defecto pasa a 'cotizado' (delivery con costo a confirmar): es como funcionaba el menú
-- hasta ahora. Los locales que ya existen reciben ese valor (la configuración se creó en 0011 y nadie la editó).

begin;

alter table public.agente_config alter column delivery_modo set default 'cotizado';
update public.agente_config set delivery_modo = 'cotizado' where delivery_modo = 'retiro';

grant select (negocio_id, delivery_modo) on public.agente_config to anon;

create policy agente_config_entrega_publica
  on public.agente_config for select to anon
  using (exists (select 1 from public.negocios n where n.id = agente_config.negocio_id and n.activo));

commit;
