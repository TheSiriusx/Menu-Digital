-- 0001_esquema.sql
-- Modelo multi-tenant: todo cuelga de negocios.id (negocio_id).
-- Se ejecuta una sola vez, pegándolo en Supabase -> SQL Editor -> Run.

begin;

-- ---------------------------------------------------------------------------
-- negocios: cada local / tenant
-- ---------------------------------------------------------------------------
create table public.negocios (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  nombre            text not null,
  tipo              text not null default 'panaderia',  -- panaderia | restaurante | fruteria | ...
  logo_url          text,
  color             text,                                -- acento del menú, ej. #C2410C
  telefono_whatsapp text,                                -- solo dígitos con código de país, ej. 584121234567
  horario           text,
  tasa_bs           numeric(12,4) not null default 0,    -- Bs por 1 USD, manual por ahora
  activo            boolean not null default true,       -- false = menú pausado (impago)
  plan              text not null default 'basico',      -- basico | pro
  created_at        timestamptz not null default now(),

  constraint negocios_slug_formato check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60
  ),
  -- /[slug] captura cualquier ruta: estos nombres se reservan para /admin, /login, etc.
  constraint negocios_slug_reservado check (
    slug not in (
      'admin', 'superadmin', 'login', 'logout', 'signup', 'registro', 'auth',
      'api', 'panel', 'dashboard', 'app', 'www', 'menu', 'static', 'public',
      'assets', 'favicon', 'robots', 'sitemap'
    )
  ),
  constraint negocios_color_formato check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  constraint negocios_tasa_no_negativa check (tasa_bs >= 0)
);

-- ---------------------------------------------------------------------------
-- categorias
-- ---------------------------------------------------------------------------
create table public.categorias (
  id         uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios (id) on delete cascade,
  nombre     text not null,
  orden      integer not null default 0,

  -- Permite que productos referencie (id, negocio_id) y así una categoría
  -- de otro negocio nunca pueda asignarse a un producto.
  constraint categorias_id_negocio_unico unique (id, negocio_id)
);

create index categorias_negocio_orden_idx on public.categorias (negocio_id, orden);

-- ---------------------------------------------------------------------------
-- productos
-- ---------------------------------------------------------------------------
create table public.productos (
  id           uuid primary key default gen_random_uuid(),
  negocio_id   uuid not null references public.negocios (id) on delete cascade,
  categoria_id uuid,
  nombre       text not null,
  descripcion  text,
  precio_usd   numeric(10,2) not null,                  -- los precios viven en USD; el Bs se calcula al mostrar
  disponible   boolean not null default true,           -- false = "Agotado"
  foto_url     text,
  orden        integer not null default 0,

  constraint productos_precio_no_negativo check (precio_usd >= 0),
  -- La categoría debe ser del mismo negocio. Si se borra la categoría el producto
  -- se conserva sin categoría (solo se anula categoria_id, no negocio_id).
  constraint productos_categoria_fk
    foreign key (categoria_id, negocio_id)
    references public.categorias (id, negocio_id)
    on delete set null (categoria_id)
);

create index productos_negocio_orden_idx on public.productos (negocio_id, orden);
create index productos_categoria_idx on public.productos (categoria_id);

-- ---------------------------------------------------------------------------
-- perfiles: dueños y superadmin, ligados a Supabase Auth (se usa desde la Fase 3)
-- ---------------------------------------------------------------------------
create table public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  negocio_id uuid references public.negocios (id) on delete cascade,
  rol        text not null default 'dueno' check (rol in ('dueno', 'superadmin')),

  -- Un dueño siempre pertenece a un negocio; el superadmin no necesita uno.
  constraint perfiles_dueno_con_negocio check (rol = 'superadmin' or negocio_id is not null)
);

create index perfiles_negocio_idx on public.perfiles (negocio_id);

-- ---------------------------------------------------------------------------
-- Seguridad: RLS activado desde ya. Sin políticas = nadie accede con la clave
-- pública. Las políticas de lectura pública llegan en 0002_rls.sql.
-- ---------------------------------------------------------------------------
alter table public.negocios   enable row level security;
alter table public.categorias enable row level security;
alter table public.productos  enable row level security;
alter table public.perfiles   enable row level security;

commit;
