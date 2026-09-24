-- seed.sql — Panadería Nueva Victoria (DATOS DE EJEMPLO)
-- Teléfono y tasa son de mentira: reemplázalos por los reales en Table Editor.
-- Re-ejecutable: si el negocio ya tiene categorías no toca nada (no pisa tus cambios).

do $$
declare
  n          uuid;
  c_panes    uuid;
  c_dulces   uuid;
  c_bebidas  uuid;
  c_especial uuid;
begin
  insert into public.negocios
    (slug, nombre, tipo, color, telefono_whatsapp, horario, tasa_bs, activo, plan)
  values
    ('nueva-victoria', 'Panadería Nueva Victoria', 'panaderia', '#B45309',
     '584120000000',
     'Lunes a sábado 6:00 am – 7:00 pm · Domingos 6:00 am – 1:00 pm',
     50.0000, true, 'basico')
  on conflict (slug) do nothing;

  select id into n from public.negocios where slug = 'nueva-victoria';

  if exists (select 1 from public.categorias where negocio_id = n) then
    raise notice 'nueva-victoria ya tiene categorías: no se inserta nada';
    return;
  end if;

  insert into public.categorias (negocio_id, nombre, orden) values (n, 'Panes', 1)
    returning id into c_panes;
  insert into public.categorias (negocio_id, nombre, orden) values (n, 'Dulces', 2)
    returning id into c_dulces;
  insert into public.categorias (negocio_id, nombre, orden) values (n, 'Bebidas', 3)
    returning id into c_bebidas;
  insert into public.categorias (negocio_id, nombre, orden) values (n, 'Especiales', 4)
    returning id into c_especial;

  insert into public.productos
    (negocio_id, categoria_id, nombre, descripcion, precio_usd, disponible, orden)
  values
    -- Panes
    (n, c_panes, 'Pan canilla',        'Crujiente por fuera, suave por dentro. Unidad.',        0.50, true,  1),
    (n, c_panes, 'Pan sobado',         'Suave y ligeramente dulce, ideal para el desayuno.',     0.30, true,  2),
    (n, c_panes, 'Pan integral',       'Con harina integral y semillas. Unidad.',                1.20, true,  3),
    (n, c_panes, 'Pan campesino',      'Corteza gruesa, miga tierna. Unidad.',                   1.00, true,  4),
    -- Dulces
    (n, c_dulces, 'Cachito de jamón',  'Hojaldre relleno de jamón. Unidad.',                     1.50, true,  1),
    (n, c_dulces, 'Croissant',         'De mantequilla, hojaldrado. Unidad.',                    1.80, true,  2),
    (n, c_dulces, 'Golfeado',          'Con queso de año y papelón. Unidad.',                    1.50, false, 3),
    (n, c_dulces, 'Quesillo',          'Porción del clásico quesillo casero.',                   2.00, true,  4),
    (n, c_dulces, 'Torta de chocolate','Porción de torta húmeda de chocolate.',                  2.50, true,  5),
    -- Bebidas
    (n, c_bebidas, 'Café marrón',      'Café con un toque de leche. Pequeño.',                   1.00, true,  1),
    (n, c_bebidas, 'Café con leche',   'Grande, con leche caliente.',                            1.50, true,  2),
    (n, c_bebidas, 'Jugo natural',     'Del día. Consulta los sabores en el local.',             1.80, false, 3),
    (n, c_bebidas, 'Refresco',         'Botella personal.',                                      1.00, true,  4),
    -- Especiales
    (n, c_especial, 'Pan de jamón',    'Porción de pan de jamón navideño, todo el año.',         3.50, true,  1),
    (n, c_especial, 'Tequeños x10',    'Diez tequeños fritos al momento.',                       6.00, true,  2),
    (n, c_especial, 'Torta de cumpleaños', 'Por encargo, con 48 horas de anticipación.',        18.00, true,  3);
end
$$;
