-- Backup legible + reimportable (ver README): reimportar_maestros() es
-- el reverso de importar_catalogo() — a diferencia de esa, además de
-- dar de alta también edita filas existentes por id (upsert, nunca
-- borra: una fila que falta en la hoja no se toca).
--
-- Dueño-only, igual que importar_catalogo() e importar el resto de
-- Stock. La lista de columnas que edita EXCLUYE a propósito
-- productos.stock_actual y clientes.saldo_cuenta_corriente: son estado
-- derivado que solo mantienen registrar_venta()/anular_venta()/
-- registrar_ajuste_stock()/registrar_movimiento_cuenta_corriente(),
-- siempre junto con su fila de auditoría en movimientos_stock /
-- movimientos_cuenta_corriente — esta función ni siquiera lee esas
-- claves del jsonb, así que no hay forma de colarlas por error.
--
-- categorias/proveedores por nombre (case-insensitive, gracias al
-- unique(lower(nombre)) de la migración anterior) — mismo criterio que
-- importar_catalogo(): el front ya normalizó y dedupe los nombres antes
-- de mandarlos.

create or replace function public.reimportar_maestros(
  p_categorias_nuevas text[],
  p_categorias_actualizar jsonb, -- [{id, nombre}]
  p_proveedores_nuevos text[],
  p_proveedores_actualizar jsonb, -- [{id, nombre, contacto, telefono}]
  p_productos jsonb, -- [{id, nombre, categoriaNombre, proveedorNombre, codigoBarras, precioCosto, precioVenta, unidad, stockMinimo, activo}]
  p_clientes jsonb -- [{id, nombre, telefono, direccion}]
)
returns table (
  categorias_creadas int,
  categorias_actualizadas int,
  proveedores_creados int,
  proveedores_actualizados int,
  productos_creados int,
  productos_actualizados int,
  clientes_creados int,
  clientes_actualizados int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categorias_creadas int := 0;
  v_categorias_actualizadas int := 0;
  v_proveedores_creados int := 0;
  v_proveedores_actualizados int := 0;
  v_productos_creados int := 0;
  v_productos_actualizados int := 0;
  v_clientes_creados int := 0;
  v_clientes_actualizados int := 0;
begin
  if coalesce(public.auth_rol(), '') <> 'dueño' then
    raise exception 'Solo el dueño puede reimportar datos maestros';
  end if;

  -- Categorias -------------------------------------------------------
  if p_categorias_nuevas is not null and array_length(p_categorias_nuevas, 1) > 0 then
    insert into public.categorias (nombre)
    select unnest(p_categorias_nuevas);
    get diagnostics v_categorias_creadas = row_count;
  end if;

  update public.categorias c
  set nombre = e.nombre
  from jsonb_to_recordset(coalesce(p_categorias_actualizar, '[]'::jsonb)) as e(id uuid, nombre text)
  where c.id = e.id;
  get diagnostics v_categorias_actualizadas = row_count;

  -- Proveedores --------------------------------------------------------
  if p_proveedores_nuevos is not null and array_length(p_proveedores_nuevos, 1) > 0 then
    insert into public.proveedores (nombre)
    select unnest(p_proveedores_nuevos);
    get diagnostics v_proveedores_creados = row_count;
  end if;

  update public.proveedores pr
  set nombre = e.nombre, contacto = e.contacto, telefono = e.telefono
  from jsonb_to_recordset(coalesce(p_proveedores_actualizar, '[]'::jsonb))
    as e(id uuid, nombre text, contacto text, telefono text)
  where pr.id = e.id;
  get diagnostics v_proveedores_actualizados = row_count;

  -- Productos: alta (id null) ------------------------------------------
  insert into public.productos (
    nombre, categoria_id, proveedor_id, codigo_barras, precio_costo, precio_venta, unidad, stock_minimo, activo
  )
  select
    p ->> 'nombre',
    (select id from public.categorias where lower(nombre) = lower(p ->> 'categoriaNombre') limit 1),
    (select id from public.proveedores where lower(nombre) = lower(p ->> 'proveedorNombre') limit 1),
    nullif(p ->> 'codigoBarras', ''),
    (p ->> 'precioCosto')::numeric,
    (p ->> 'precioVenta')::numeric,
    p ->> 'unidad',
    (p ->> 'stockMinimo')::numeric,
    (p ->> 'activo')::boolean
  from jsonb_array_elements(coalesce(p_productos, '[]'::jsonb)) as p
  where (p ->> 'id') is null;
  get diagnostics v_productos_creados = row_count;

  -- Productos: edición (id presente) -- nunca toca stock_actual.
  update public.productos prod
  set nombre = e.nombre,
      categoria_id = (select id from public.categorias where lower(nombre) = lower(e."categoriaNombre") limit 1),
      proveedor_id = (select id from public.proveedores where lower(nombre) = lower(e."proveedorNombre") limit 1),
      codigo_barras = nullif(e."codigoBarras", ''),
      precio_costo = e."precioCosto",
      precio_venta = e."precioVenta",
      unidad = e.unidad,
      stock_minimo = e."stockMinimo",
      activo = e.activo,
      actualizado_en = now()
  from jsonb_to_recordset(coalesce(p_productos, '[]'::jsonb)) as e(
    id uuid,
    nombre text,
    "categoriaNombre" text,
    "proveedorNombre" text,
    "codigoBarras" text,
    "precioCosto" numeric,
    "precioVenta" numeric,
    unidad text,
    "stockMinimo" numeric,
    activo boolean
  )
  where prod.id = e.id;
  get diagnostics v_productos_actualizados = row_count;

  -- Clientes: alta (id null) --------------------------------------------
  insert into public.clientes (nombre, telefono, direccion)
  select c ->> 'nombre', nullif(c ->> 'telefono', ''), nullif(c ->> 'direccion', '')
  from jsonb_array_elements(coalesce(p_clientes, '[]'::jsonb)) as c
  where (c ->> 'id') is null;
  get diagnostics v_clientes_creados = row_count;

  -- Clientes: edición (id presente) -- nunca toca saldo_cuenta_corriente.
  update public.clientes cli
  set nombre = e.nombre, telefono = nullif(e.telefono, ''), direccion = nullif(e.direccion, '')
  from jsonb_to_recordset(coalesce(p_clientes, '[]'::jsonb)) as e(id uuid, nombre text, telefono text, direccion text)
  where cli.id = e.id;
  get diagnostics v_clientes_actualizados = row_count;

  return query select
    v_categorias_creadas, v_categorias_actualizadas,
    v_proveedores_creados, v_proveedores_actualizados,
    v_productos_creados, v_productos_actualizados,
    v_clientes_creados, v_clientes_actualizados;
end;
$$;
