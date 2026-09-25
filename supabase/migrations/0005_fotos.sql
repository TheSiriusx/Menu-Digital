-- 0005_fotos.sql
-- Fotos de productos y logo de los locales (Supabase Storage). Se ejecuta una sola vez.
--
-- Bucket público `menu-media` (el menú es público, cualquiera puede ver las fotos por su URL).
-- Archivos en `{id_del_local}/{nombre-único}.webp`. Solo escribe el dueño en la carpeta de SU
-- local (y solo si está activo, coherente con el solo lectura por impago) o el super admin.

begin;

-- ---------------------------------------------------------------------------
-- Bucket: tamaño y tipos limitados (SVG queda fuera a propósito: puede llevar scripts).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-media', 'menu-media', true, 512000, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Políticas de storage.objects. La lectura pública de un bucket público no pasa por
-- aquí (se sirve por /object/public/...); estas reglas gobiernan escribir y borrar.
-- (storage.foldername(name))[1] es la primera carpeta de la ruta: el id del local.
-- ---------------------------------------------------------------------------
create policy menu_media_lee_propio
  on storage.objects for select to authenticated
  using (
    bucket_id = 'menu-media'
    and ((storage.foldername(name))[1] = (select public.mi_negocio_id())::text
         or (select public.es_superadmin()))
  );

create policy menu_media_inserta
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'menu-media'
    and ((storage.foldername(name))[1] = (select public.mi_negocio_activo_id())::text
         or (select public.es_superadmin()))
  );

create policy menu_media_actualiza
  on storage.objects for update to authenticated
  using (
    bucket_id = 'menu-media'
    and ((storage.foldername(name))[1] = (select public.mi_negocio_activo_id())::text
         or (select public.es_superadmin()))
  )
  with check (
    bucket_id = 'menu-media'
    and ((storage.foldername(name))[1] = (select public.mi_negocio_activo_id())::text
         or (select public.es_superadmin()))
  );

create policy menu_media_borra
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'menu-media'
    and ((storage.foldername(name))[1] = (select public.mi_negocio_activo_id())::text
         or (select public.es_superadmin()))
  );

-- ---------------------------------------------------------------------------
-- Columnas de imagen: ahora el dueño puede actualizarlas (en 0003 quedaron fuera).
-- ---------------------------------------------------------------------------
grant update (foto_url) on public.productos to authenticated;
grant update (logo_url) on public.negocios to authenticated;

-- ---------------------------------------------------------------------------
-- Solo se aceptan imágenes de NUESTRO Storage y de la carpeta del propio local. Así nadie
-- puede poner imágenes externas (o de rastreo) en un menú, ni hablando directo con la API.
--   https://<ref>.supabase.co/storage/v1/object/public/menu-media/<id_local>/<archivo>
-- split_part(..., '/', 9) es la carpeta del local.
-- ---------------------------------------------------------------------------
alter table public.productos
  add constraint productos_foto_url_propia check (
    foto_url is null or (
      foto_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/menu-media/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'
      and split_part(foto_url, '/', 9) = negocio_id::text
    )
  );

alter table public.negocios
  add constraint negocios_logo_url_propio check (
    logo_url is null or (
      logo_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/menu-media/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'
      and split_part(logo_url, '/', 9) = id::text
    )
  );

commit;
