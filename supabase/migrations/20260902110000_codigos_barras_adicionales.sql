-- Pedido del dueño (2026-09-02, audio): poder cargar hasta 6 códigos de
-- barra por producto. Textual: *"la salsa lista que tengo, que son los
-- de Arcor, todos van al mismo precio y mayormente todos salen a la
-- vez... para ya no estar tanto tipeando salsa lista pomarola, salsa
-- lista italiana"*. Y el segundo caso: *"hay algunos productos que
-- también han cambiado el código de barra"*.
--
-- Decidido con Enzo: `productos.codigo_barras` SIGUE SIENDO el código
-- principal (el que se muestra en listados y el que viaja en el Excel
-- de import/export, que no cambia), y esta tabla guarda hasta 5
-- adicionales. La alternativa era mover los 6 a una tabla única, más
-- prolija pero mucho más invasiva justo antes de que el local abra.
--
-- La contra de tener el código en dos lugares es que nada impide, por
-- sí solo, que el mismo código quede cargado como principal de un
-- producto y como adicional de otro. Por eso van los dos triggers de
-- abajo: uno por cada lado, para que el `unique` valga sobre el
-- conjunto y no sobre cada tabla por separado.

create table public.productos_codigos_barras (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id) on delete cascade,
  codigo text not null unique,
  creado_en timestamptz not null default now()
);

create index productos_codigos_barras_producto_idx
  on public.productos_codigos_barras (producto_id);

alter table public.productos_codigos_barras enable row level security;

-- Mismo reparto que productos (Fase 1 de PLAN-ROLES-AUDITORIA.md): el
-- operador necesita LEER los códigos para poder vender escaneando, pero
-- tocar el catálogo es del dueño.
create policy "productos_codigos_select_perfil_activo" on public.productos_codigos_barras
for select to authenticated
using (coalesce(public.auth_activo(), false));

create policy "productos_codigos_escribe_dueño" on public.productos_codigos_barras
for all to authenticated
using (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño')
with check (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño');

-- ============================================================
-- Unicidad cruzada entre productos.codigo_barras y esta tabla
-- ============================================================
create or replace function public.verificar_codigo_adicional_libre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  select nombre into v_nombre from public.productos where codigo_barras = new.codigo;
  if found then
    raise exception 'El código % ya es el código principal de "%"', new.codigo, v_nombre;
  end if;
  return new;
end;
$$;

create trigger productos_codigos_no_pisa_principal
before insert or update of codigo on public.productos_codigos_barras
for each row execute function public.verificar_codigo_adicional_libre();

create or replace function public.verificar_codigo_principal_libre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  if new.codigo_barras is null then
    return new;
  end if;

  select p.nombre into v_nombre
  from public.productos_codigos_barras c
  join public.productos p on p.id = c.producto_id
  where c.codigo = new.codigo_barras and c.producto_id <> new.id;

  if found then
    raise exception 'El código % ya está cargado como código adicional de "%"', new.codigo_barras, v_nombre;
  end if;
  return new;
end;
$$;

create trigger productos_principal_no_pisa_adicional
before insert or update of codigo_barras on public.productos
for each row execute function public.verificar_codigo_principal_libre();

-- ============================================================
-- Tope de 5 adicionales (6 con el principal), que es lo que se pidió.
-- Va también en la base y no solo en la pantalla: el front manda la
-- lista completa de una, y sin esto un bug de UI podría cargar 50.
-- ============================================================
create or replace function public.verificar_tope_codigos_adicionales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.productos_codigos_barras where producto_id = new.producto_id) > 5 then
    raise exception 'Un producto puede tener hasta 6 códigos de barra (1 principal + 5 adicionales)';
  end if;
  return null;
end;
$$;

create constraint trigger productos_codigos_tope
after insert or update on public.productos_codigos_barras
deferrable initially deferred
for each row execute function public.verificar_tope_codigos_adicionales();

-- ============================================================
-- guardar_codigos_barras_adicionales
-- Reemplaza de una la lista completa de un producto: borra los que
-- estaban e inserta los que vengan. Es lo que necesita el formulario,
-- que muestra las 5 casillas juntas y no sabe cuáles cambiaron.
-- ============================================================
create or replace function public.guardar_codigos_barras_adicionales(
  p_producto_id uuid,
  p_codigos text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limpios text[];
begin
  if not coalesce(public.auth_activo(), false) then
    raise exception 'No tenés una sesión activa para editar el catálogo';
  end if;

  if coalesce(public.auth_rol(), '') <> 'dueño' then
    raise exception 'Solo el dueño puede editar los códigos de barra';
  end if;

  if not exists (select 1 from public.productos where id = p_producto_id) then
    raise exception 'El producto no existe';
  end if;

  -- Sin vacíos y sin repetidos dentro de la misma lista: el formulario
  -- manda 5 casillas y lo normal es que varias vengan en blanco.
  -- El distinct va sobre el valor YA recortado: si no, " 779" y "779"
  -- pasan los dos y después chocan contra el unique al insertar.
  select coalesce(array_agg(distinct trim(codigo)), '{}')
  into v_limpios
  from unnest(coalesce(p_codigos, '{}')) as codigo
  where nullif(trim(codigo), '') is not null;

  if array_length(v_limpios, 1) > 5 then
    raise exception 'Un producto puede tener hasta 5 códigos adicionales';
  end if;

  delete from public.productos_codigos_barras where producto_id = p_producto_id;

  if array_length(v_limpios, 1) > 0 then
    insert into public.productos_codigos_barras (producto_id, codigo)
    select p_producto_id, codigo from unnest(v_limpios) as codigo;
  end if;
end;
$$;

-- ============================================================
-- La vista suma los adicionales como array, para que el front los
-- reciba junto con el producto y no haga una segunda consulta: el
-- escáner del TPV busca contra la lista ya cargada en memoria.
-- ============================================================
drop view public.productos_visibles;

create view public.productos_visibles
with (security_invoker = true)
as
select
  p.id,
  p.nombre,
  p.categoria_id,
  p.proveedor_id,
  p.codigo_barras,
  coalesce(
    (select array_agg(c.codigo order by c.creado_en, c.codigo)
     from public.productos_codigos_barras c
     where c.producto_id = p.id),
    '{}'::text[]
  ) as codigos_adicionales,
  case when coalesce(public.auth_rol(), '') = 'dueño' then p.precio_costo else null end as precio_costo,
  p.precio_venta,
  p.incluye_iva,
  p.porcentaje_ganancia,
  p.stock_actual,
  p.stock_minimo,
  p.unidad,
  p.activo,
  p.creado_en,
  p.actualizado_en
from public.productos p;

grant select on public.productos_visibles to authenticated;
