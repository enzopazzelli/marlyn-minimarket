-- Bug reportado por Jason (2026-09-10, captura): al agregar un código
-- adicional a un producto, el sistema respondía "el código X ya es el
-- código principal de 'GALLETA OREO TUBO 118G'" — pero esa galleta no
-- aparece en ningún lado de /stock. Causa: ese producto está
-- soft-deleted (`activo = false`, conserva la fila por tener ventas
-- viejas — ver "Borrar ya no se bloquea, se acomoda" en el README), y
-- los tres triggers/constraint de códigos de barra comparaban contra
-- TODOS los productos sin filtrar por `activo`. Un producto eliminado
-- no debería poder seguir bloqueando su código para siempre: se
-- confirmó con una consulta de solo lectura que ese es exactamente el
-- caso (id 431573d1-ffc7-4168-9ae0-165dd499c062, activo=false, mismo
-- código_barras que el error).
--
-- Se corrigen los tres puntos donde puede pasar lo mismo:
-- 1) código adicional nuevo vs. código principal de otro producto
-- 2) código principal nuevo vs. código adicional de otro producto
-- 3) código principal nuevo vs. código principal de otro producto (el
--    `unique` liso de la columna, que no distingue activo/inactivo)

create or replace function public.verificar_codigo_adicional_libre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  select nombre into v_nombre
  from public.productos
  where codigo_barras = new.codigo and activo;

  if found then
    raise exception 'El código % ya es el código principal de "%"', new.codigo, v_nombre;
  end if;
  return new;
end;
$$;

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
  where c.codigo = new.codigo_barras and c.producto_id <> new.id and p.activo;

  if found then
    raise exception 'El código % ya está cargado como código adicional de "%"', new.codigo_barras, v_nombre;
  end if;
  return new;
end;
$$;

-- El `unique` liso de la columna no sabe de `activo`: bloqueaba usar de
-- principal en un producto vivo un código que ya era principal de uno
-- eliminado. Pasa a unique solo entre los activos (índice parcial); los
-- eliminados pueden repetirse entre sí sin problema, ya no importan
-- para la venta ni el escaneo.
alter table public.productos drop constraint if exists productos_codigo_barras_key;

create unique index productos_codigo_barras_activo_unique
  on public.productos (codigo_barras)
  where activo;
