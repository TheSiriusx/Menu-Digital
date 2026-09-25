-- 0007_esquema_agente.sql
-- Esquema para el agente de WhatsApp: stock, instancia de Evolution, categorías activas y las
-- tablas pedidos / pedido_items / clientes. Es ADITIVA: el código que ya está desplegado sigue
-- funcionando. Los permisos y el RLS de lo nuevo están en 0008; las funciones, en 0009.
-- (0006 queda reservada para la migración de MFA del super admin, que se aplica por separado.)

begin;

-- ---------------------------------------------------------------------------
-- productos.stock: null = sin control de stock (siempre disponible, p. ej. pan a demanda).
-- Con un número, cada venta lo descuenta y al llegar a 0 el producto pasa a "Agotado" solo.
-- ---------------------------------------------------------------------------
alter table public.productos add column stock integer;
alter table public.productos
  add constraint productos_stock_rango check (stock is null or stock between 0 and 1000000);

-- Para que pedido_items pueda exigir que el producto sea del mismo local del pedido.
alter table public.productos add constraint productos_id_negocio_unico unique (id, negocio_id);

-- disponible es lo único que ve el público. Con stock controlado se mantiene solo:
--   stock = 0            -> agotado
--   sube de 0 a > 0      -> vuelve a estar disponible
-- Descontar de 5 a 4 NO toca disponible (si el dueño pausó el producto a mano, sigue pausado).
create or replace function public.productos_disponible_por_stock()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stock is not null then
    if new.stock = 0 then
      new.disponible := false;
    elsif tg_op = 'UPDATE' and old.stock = 0 then
      new.disponible := true;
    end if;
  end if;
  return new;
end
$$;

create trigger productos_disponible_por_stock
  before insert or update on public.productos
  for each row execute function public.productos_disponible_por_stock();

-- ---------------------------------------------------------------------------
-- categorias.activa: el dueño puede ocultar una categoría (y sus productos) del menú público.
-- ---------------------------------------------------------------------------
alter table public.categorias add column activa boolean not null default true;

-- ---------------------------------------------------------------------------
-- negocios.evolution_instance_name: cada local tiene su propia instancia en Evolution API.
-- null = todavía no tiene ("WhatsApp pendiente"). No se expone a nadie por la API (ver 0008).
-- ---------------------------------------------------------------------------
alter table public.negocios add column evolution_instance_name text;
alter table public.negocios
  add constraint negocios_instancia_formato
  check (evolution_instance_name is null or evolution_instance_name ~ '^[a-z0-9][a-z0-9-]{0,62}$');
create unique index negocios_instancia_unica
  on public.negocios (evolution_instance_name) where evolution_instance_name is not null;

-- ---------------------------------------------------------------------------
-- clientes: quien compra por WhatsApp. Un teléfono es un cliente por local.
-- ---------------------------------------------------------------------------
create table public.clientes (
  id             uuid primary key default gen_random_uuid(),
  negocio_id     uuid not null references public.negocios (id) on delete cascade,
  telefono       text not null,
  nombre         text,
  primera_compra timestamptz not null default now(),
  ultima_compra  timestamptz not null default now(),

  constraint clientes_telefono_formato check (telefono ~ '^[0-9]{10,15}$'),
  constraint clientes_nombre_largo check (nombre is null or char_length(nombre) <= 80),
  constraint clientes_telefono_por_local unique (negocio_id, telefono),
  constraint clientes_id_negocio_unico unique (id, negocio_id)
);

-- ---------------------------------------------------------------------------
-- pedidos: cada venta registrada por el agente.
-- ---------------------------------------------------------------------------
create table public.pedidos (
  id                uuid primary key default gen_random_uuid(),
  negocio_id        uuid not null references public.negocios (id) on delete cascade,
  cliente_id        uuid,
  cliente_telefono  text not null,
  cliente_nombre    text,
  total_usd         numeric(12,2) not null,
  tasa_bs           numeric(12,4) not null default 0,     -- foto de la tasa al vender: los reportes en Bs no cambian después
  metodo_pago       text,
  estado            text not null default 'nuevo',
  entrega           text not null default 'retiro',
  direccion         text,
  notas             text,
  origen_mensaje_id text,                                 -- id del mensaje de WhatsApp: evita duplicados si el webhook se repite
  created_at        timestamptz not null default now(),

  constraint pedidos_total_no_negativo check (total_usd >= 0),
  constraint pedidos_tasa_no_negativa check (tasa_bs >= 0),
  constraint pedidos_estado_valido check (estado in ('nuevo', 'confirmado', 'pagado', 'entregado', 'cancelado')),
  constraint pedidos_entrega_valida check (entrega in ('retiro', 'domicilio')),
  constraint pedidos_telefono_formato check (cliente_telefono ~ '^[0-9]{10,15}$'),
  constraint pedidos_textos_largos check (
    (cliente_nombre is null or char_length(cliente_nombre) <= 80)
    and (metodo_pago is null or char_length(metodo_pago) <= 40)
    and (direccion is null or char_length(direccion) <= 300)
    and (notas is null or char_length(notas) <= 500)
    and (origen_mensaje_id is null or char_length(origen_mensaje_id) <= 200)
  ),
  constraint pedidos_id_negocio_unico unique (id, negocio_id),
  -- El cliente debe ser del mismo local. Si se borra el cliente, el pedido se conserva.
  constraint pedidos_cliente_fk foreign key (cliente_id, negocio_id)
    references public.clientes (id, negocio_id) on delete set null (cliente_id)
);

create unique index pedidos_origen_unico
  on public.pedidos (negocio_id, origen_mensaje_id) where origen_mensaje_id is not null;
create index pedidos_negocio_fecha_idx on public.pedidos (negocio_id, created_at desc);
create index pedidos_negocio_estado_idx on public.pedidos (negocio_id, estado);
create index pedidos_cliente_idx on public.pedidos (cliente_id);

-- ---------------------------------------------------------------------------
-- pedido_items: líneas del pedido, con foto del nombre y del precio al momento de vender
-- (el producto puede cambiar de precio, renombrarse o borrarse después).
-- ---------------------------------------------------------------------------
create table public.pedido_items (
  id                  uuid primary key default gen_random_uuid(),
  pedido_id           uuid not null,
  negocio_id          uuid not null references public.negocios (id) on delete cascade,
  producto_id         uuid,
  nombre_producto     text not null,
  cantidad            integer not null,
  precio_unitario_usd numeric(10,2) not null,

  constraint pedido_items_cantidad_rango check (cantidad between 1 and 999),
  constraint pedido_items_precio_no_negativo check (precio_unitario_usd >= 0),
  constraint pedido_items_nombre_largo check (char_length(nombre_producto) between 1 and 120),
  -- El item debe ser del mismo local que su pedido.
  constraint pedido_items_pedido_fk foreign key (pedido_id, negocio_id)
    references public.pedidos (id, negocio_id) on delete cascade,
  -- Y el producto también. Si se borra el producto, el item se conserva (con su nombre y precio).
  constraint pedido_items_producto_fk foreign key (producto_id, negocio_id)
    references public.productos (id, negocio_id) on delete set null (producto_id)
);

create index pedido_items_pedido_idx on public.pedido_items (pedido_id);
create index pedido_items_producto_idx on public.pedido_items (negocio_id, producto_id);

-- RLS activado ya, sin políticas: hasta 0008 nadie las puede leer ni escribir con la clave pública.
alter table public.clientes     enable row level security;
alter table public.pedidos      enable row level security;
alter table public.pedido_items enable row level security;

-- Supabase da por defecto ALL a anon y authenticated en tablas nuevas de public: se quita.
revoke all on public.clientes, public.pedidos, public.pedido_items from anon, authenticated;

commit;
