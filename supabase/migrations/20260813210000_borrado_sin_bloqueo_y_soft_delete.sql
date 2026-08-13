-- Borrar un rubro/proveedor ya no se bloquea porque haya productos
-- usándolo — quedan sin ese dato (categoria_id/proveedor_id en null),
-- mismo criterio que "sin código de barras": un producto puede no
-- tener rubro/proveedor asignado. Busca el nombre real de cada FK en
-- vez de asumirlo, por si no coincide con el default de Postgres.
do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'public.productos'::regclass
    and confrelid = 'public.categorias'::regclass
    and contype = 'f';
  if v_constraint_name is not null then
    execute format('alter table public.productos drop constraint %I', v_constraint_name);
  end if;

  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'public.productos'::regclass
    and confrelid = 'public.proveedores'::regclass
    and contype = 'f';
  if v_constraint_name is not null then
    execute format('alter table public.productos drop constraint %I', v_constraint_name);
  end if;
end $$;

alter table public.productos
  add constraint productos_categoria_id_fkey
  foreign key (categoria_id) references public.categorias (id) on delete set null;

alter table public.productos
  add constraint productos_proveedor_id_fkey
  foreign key (proveedor_id) references public.proveedores (id) on delete set null;

-- productos.activo (existe desde el día 1, default true, sin uso real
-- hasta ahora) pasa a significar "eliminado" para productos que ya
-- tienen ventas o movimientos de stock: ventas_items.producto_id y
-- movimientos_stock.producto_id son `not null`, así que esos productos
-- no se pueden borrar de verdad sin perder esa fila del historial — el
-- front (eliminarProducto.ts) intenta el delete real primero y recién
-- si choca con esas dos tablas cae a poner activo = false.
comment on column public.productos.activo is
  'false = "eliminado": no se vende más, pero se conserva porque tiene ventas o movimientos de stock que lo referencian.';
