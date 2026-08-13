-- Import de catálogo desde Excel: con ~3000 filas más las categorías y
-- proveedores nuevos que traigan, esto tiene que ser todo-o-nada, mismo
-- criterio que registrar_venta()/registrar_ingreso_stock(). El front ya
-- manda los nombres normalizados y deduplicados (ver
-- src/modulos/stock/consultas/importarExcel.ts) — acá solo se insertan.

create or replace function public.importar_catalogo(
  p_categorias_nuevas text[],
  p_proveedores_nuevos text[],
  p_productos jsonb
)
returns table(productos_creados int, categorias_creadas int, proveedores_creados int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categorias_creadas int := 0;
  v_proveedores_creados int := 0;
  v_productos_creados int := 0;
begin
  if not coalesce(public.auth_activo(), false) then
    raise exception 'No tenés una sesión activa para importar el catálogo';
  end if;

  if p_categorias_nuevas is not null and array_length(p_categorias_nuevas, 1) > 0 then
    insert into public.categorias (nombre)
    select unnest(p_categorias_nuevas);
    get diagnostics v_categorias_creadas = row_count;
  end if;

  if p_proveedores_nuevos is not null and array_length(p_proveedores_nuevos, 1) > 0 then
    insert into public.proveedores (nombre)
    select unnest(p_proveedores_nuevos);
    get diagnostics v_proveedores_creados = row_count;
  end if;

  insert into public.productos (nombre, categoria_id, proveedor_id, codigo_barras, precio_costo, precio_venta)
  select
    p ->> 'nombre',
    (select id from public.categorias where lower(nombre) = lower(p ->> 'categoriaNombre') limit 1),
    (select id from public.proveedores where lower(nombre) = lower(p ->> 'proveedorNombre') limit 1),
    p ->> 'codigoBarras',
    (p ->> 'precioCosto')::numeric,
    (p ->> 'precioVenta')::numeric
  from jsonb_array_elements(p_productos) as p;
  get diagnostics v_productos_creados = row_count;

  return query select v_productos_creados, v_categorias_creadas, v_proveedores_creados;
end;
$$;
