-- El import de catálogo ahora también acepta el formato de la plantilla
-- que exporta esta misma app (Código de barras/Producto/Rubro/Proveedor/
-- Precio costo/Precio venta/Stock actual/Stock mínimo/Unidad), además
-- del export del sistema viejo que ya soportaba. Ese formato trae dos
-- datos que antes no llegaban: `unidad` y `stockMinimo`.
--
-- Se mantiene la misma lista de parámetros (3) a propósito: cambiarla
-- haría que `create or replace` cree una SOBRECARGA nueva en vez de
-- reemplazar, y quedarían dos versiones vivas — el bug que documenta la
-- migración 20260825100000. Los datos nuevos viajan adentro del jsonb
-- de p_productos, que no tiene forma fija.
--
-- Los campos sin información quedan vacíos, no inventados:
--   categoriaNombre / proveedorNombre en ""  -> categoria_id / proveedor_id null
--   codigoBarras vacío                       -> null (el unique lo permite repetido)
--   precioCosto / stockMinimo ausentes       -> 0
--   unidad ausente                           -> 'unidad', el default de la tabla
--
-- NO se importa `Stock actual` aunque la plantilla lo traiga: el stock
-- es estado derivado que solo mueven registrar_venta(), anular_venta(),
-- registrar_ajuste_stock() y registrar_ingreso_stock(), siempre junto a
-- su fila en movimientos_stock. Mismo criterio que ya tomó
-- reimportar_maestros() (migración 20260819150000). La mercadería se
-- carga después con "Ingresar mercadería"; el front avisa cuántas filas
-- del archivo traían stock para que no pase desapercibido.

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

  if coalesce(public.auth_rol(), '') <> 'dueño' then
    raise exception 'Solo el dueño puede importar un catálogo';
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

  insert into public.productos (
    nombre, categoria_id, proveedor_id, codigo_barras,
    precio_costo, precio_venta, unidad, stock_minimo
  )
  select
    p ->> 'nombre',
    (select id from public.categorias
      where lower(nombre) = lower(nullif(p ->> 'categoriaNombre', '')) limit 1),
    (select id from public.proveedores
      where lower(nombre) = lower(nullif(p ->> 'proveedorNombre', '')) limit 1),
    nullif(p ->> 'codigoBarras', ''),
    coalesce((p ->> 'precioCosto')::numeric, 0),
    coalesce((p ->> 'precioVenta')::numeric, 0),
    coalesce(nullif(p ->> 'unidad', ''), 'unidad'),
    coalesce((p ->> 'stockMinimo')::numeric, 0)
  from jsonb_array_elements(p_productos) as p;
  get diagnostics v_productos_creados = row_count;

  return query select v_productos_creados, v_categorias_creadas, v_proveedores_creados;
end;
$$;
