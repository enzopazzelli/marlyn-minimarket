-- Fase 1 de PLAN-ROLES-AUDITORIA.md: la barrera real de "el operador no
-- ve/hace X" vive acá, no en la UI (React se puede saltear desde la
-- consola del navegador — la clave anon es pública a propósito, regla 2
-- del prompt-base). Todo lo de abajo se apoya en perfiles.rol
-- ('dueño'/'operador', existe desde el día 1) y en auth_rol(), ya
-- NULL-safe (regla 1).

-- 1) Vista de productos sin costo para quien no es dueño. RLS filtra
-- filas, no columnas, y dueño/operador comparten el mismo rol de
-- Postgres (authenticated) -- un `select *` directo a productos
-- seguiría trayendo precio_costo para cualquiera sin esto. security_
-- invoker=true para que la vista NO bypasee la RLS de productos (por
-- default, una vista corre con los permisos de su dueño; con esto,
-- corre con los del que consulta, así que sigue exigiendo perfil activo
-- igual que la tabla).
create view public.productos_visibles
with (security_invoker = true)
as
select
  id,
  nombre,
  categoria_id,
  proveedor_id,
  codigo_barras,
  case when coalesce(public.auth_rol(), '') = 'dueño' then precio_costo else null end as precio_costo,
  precio_venta,
  incluye_iva,
  porcentaje_ganancia,
  stock_actual,
  stock_minimo,
  unidad,
  activo,
  creado_en,
  actualizado_en
from public.productos;

grant select on public.productos_visibles to authenticated;

-- 2) Escritura de catálogo (productos/categorías/proveedores) pasa a
-- ser solo del dueño. La lectura sigue abierta a cualquier perfil
-- activo: el operador necesita ver el catálogo para vender y ajustar
-- stock, solo no puede darlo de alta/editarlo/borrarlo ni tocar rubros
-- o proveedores. Se reemplaza la única policy "for all" de cada tabla
-- por cuatro (select abierta, insert/update/delete de dueño) porque
-- Postgres no permite listar varios comandos en un mismo `for`.

drop policy "productos_acceso_perfil_activo" on public.productos;

create policy "productos_select_perfil_activo" on public.productos
for select to authenticated
using (coalesce(public.auth_activo(), false));

create policy "productos_insert_dueño" on public.productos
for insert to authenticated
with check (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño');

create policy "productos_update_dueño" on public.productos
for update to authenticated
using (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño')
with check (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño');

create policy "productos_delete_dueño" on public.productos
for delete to authenticated
using (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño');

drop policy "categorias_acceso_perfil_activo" on public.categorias;

create policy "categorias_select_perfil_activo" on public.categorias
for select to authenticated
using (coalesce(public.auth_activo(), false));

create policy "categorias_insert_dueño" on public.categorias
for insert to authenticated
with check (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño');

create policy "categorias_update_dueño" on public.categorias
for update to authenticated
using (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño')
with check (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño');

create policy "categorias_delete_dueño" on public.categorias
for delete to authenticated
using (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño');

drop policy "proveedores_acceso_perfil_activo" on public.proveedores;

create policy "proveedores_select_perfil_activo" on public.proveedores
for select to authenticated
using (coalesce(public.auth_activo(), false));

create policy "proveedores_insert_dueño" on public.proveedores
for insert to authenticated
with check (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño');

create policy "proveedores_update_dueño" on public.proveedores
for update to authenticated
using (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño')
with check (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño');

create policy "proveedores_delete_dueño" on public.proveedores
for delete to authenticated
using (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño');

-- 3) importar_catalogo() es security definer (bypasea RLS): necesita su
-- propio chequeo interno, igual que cualquier otra función que toque
-- productos/categorías/proveedores desde acá en adelante.
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

-- 4) registrar_ajuste_stock(): quien no es dueño no puede colar un
-- cambio de precio de venta dentro de un ajuste de stock ("Entrada" en
-- FormularioAjusteStock.tsx trae ese campo). Se ignora el parámetro en
-- vez de fallar, para no romper el flujo normal de reponer mercadería.
create or replace function public.registrar_ajuste_stock(
  p_producto_id uuid,
  p_cantidad numeric,
  p_tipo text,
  p_precio_venta_nuevo numeric default null,
  p_motivo text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_actual numeric;
  v_delta numeric;
  v_tipo_movimiento text;
  v_stock_nuevo numeric;
begin
  if not coalesce(public.auth_activo(), false) then
    raise exception 'No tenés una sesión activa para ajustar stock';
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad tiene que ser mayor a cero';
  end if;

  if p_tipo not in ('entrada', 'salida') then
    raise exception 'Tipo de ajuste inválido';
  end if;

  if p_tipo = 'salida' and (p_motivo is null or trim(p_motivo) = '') then
    raise exception 'Contá el motivo de la salida (rotura, vencido, corrección de conteo)';
  end if;

  if coalesce(public.auth_rol(), '') <> 'dueño' then
    p_precio_venta_nuevo := null;
  end if;

  v_delta := case when p_tipo = 'entrada' then p_cantidad else -p_cantidad end;
  v_tipo_movimiento := case when p_tipo = 'entrada' then 'ingreso' else 'ajuste' end;

  select stock_actual into v_stock_actual
  from public.productos
  where id = p_producto_id
  for update;

  if not found then
    raise exception 'El producto no existe';
  end if;

  if v_stock_actual + v_delta < 0 then
    raise exception 'No hay stock suficiente: hay % y se intentó restar %', v_stock_actual, p_cantidad;
  end if;

  update public.productos
  set stock_actual = stock_actual + v_delta,
      precio_venta = coalesce(p_precio_venta_nuevo, precio_venta),
      actualizado_en = now()
  where id = p_producto_id
  returning stock_actual into v_stock_nuevo;

  insert into public.movimientos_stock (producto_id, tipo, cantidad, motivo, usuario_id)
  values (
    p_producto_id,
    v_tipo_movimiento,
    v_delta,
    coalesce(p_motivo, case when p_tipo = 'entrada' then 'Ingreso de mercadería' else 'Ajuste de stock' end),
    auth.uid()
  );

  return v_stock_nuevo;
end;
$$;

-- 5) registrar_movimiento_cuenta_corriente(): el recargo por atraso
-- queda solo para el dueño (motivador del pedido: un operador podría
-- recargarle a un cliente con deuda sin que corresponda). El chequeo va
-- apenas se sabe que el tipo es válido, antes de tocar el cliente —
-- así no hace falta que el cliente exista para que el bloqueo aplique.
create or replace function public.registrar_movimiento_cuenta_corriente(
  p_cliente_id uuid,
  p_tipo text,
  p_monto numeric,
  p_nota text default null,
  p_medio text default null,
  p_turno_caja_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre_cliente text;
begin
  if not coalesce(public.auth_activo(), false) then
    raise exception 'No tenés una sesión activa para registrar este movimiento';
  end if;

  if p_tipo not in ('pago', 'recargo') then
    raise exception 'Tipo de movimiento inválido: %', p_tipo;
  end if;

  if p_tipo = 'recargo' and coalesce(public.auth_rol(), '') <> 'dueño' then
    raise exception 'Solo el dueño puede aplicar un recargo por atraso';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto tiene que ser mayor a cero';
  end if;

  if p_tipo = 'pago' then
    if p_medio not in ('efectivo', 'transferencia') then
      raise exception 'Elegí si el pago fue en efectivo o transferencia';
    end if;

    if p_medio = 'efectivo' and p_turno_caja_id is null then
      raise exception 'Para cobrar en efectivo necesitás la caja abierta';
    end if;
  end if;

  update public.clientes
  set saldo_cuenta_corriente = saldo_cuenta_corriente
    + (case when p_tipo = 'recargo' then p_monto else -p_monto end)
  where id = p_cliente_id
  returning nombre into v_nombre_cliente;

  if not found then
    raise exception 'El cliente no existe';
  end if;

  insert into public.movimientos_cuenta_corriente (cliente_id, tipo, monto, nota, creado_por)
  values (p_cliente_id, p_tipo, p_monto, p_nota, auth.uid());

  if p_tipo = 'pago' and p_medio = 'efectivo' then
    insert into public.movimientos_caja (turno_id, tipo, monto, motivo, usuario_id)
    values (p_turno_caja_id, 'ingreso', p_monto, 'Pago cta. cte. — ' || v_nombre_cliente, auth.uid());
  end if;
end;
$$;

-- 6) turnos_caja: dueño ve todos (necesita el historial completo del
-- local), operador solo los propios (turno abierto actual + sus
-- cierres pasados). Se deja afuera a propósito una policy de delete —
-- nunca existió una forma de borrar un turno desde la app.
drop policy "turnos_caja_acceso_perfil_activo" on public.turnos_caja;

create policy "turnos_caja_select_propio_o_dueño" on public.turnos_caja
for select to authenticated
using (
  coalesce(public.auth_activo(), false)
  and (coalesce(public.auth_rol(), '') = 'dueño' or usuario_id = auth.uid())
);

create policy "turnos_caja_insert_activo" on public.turnos_caja
for insert to authenticated
with check (coalesce(public.auth_activo(), false));

create policy "turnos_caja_update_activo" on public.turnos_caja
for update to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));

-- 7) movimientos_caja: mismo criterio de visibilidad que turnos_caja
-- (dueño ve todo, operador solo lo propio) usando la columna
-- usuario_id agregada en la Fase 0 — no alcanza con proteger solo
-- turnos_caja, porque esta es una tabla aparte con su propia policy
-- (regla 2: cada tabla lleva su propio filtro, no alcanza con que otra
-- tabla relacionada esté protegida). De paso, el insert directo que
-- hace FormularioMovimientoCaja.tsx (el único que no pasa por una
-- función security definer) ya no puede grabar un movimiento a nombre
-- de otro usuario: with check exige usuario_id = auth.uid().
drop policy "movimientos_caja_acceso_perfil_activo" on public.movimientos_caja;

create policy "movimientos_caja_select_propio_o_dueño" on public.movimientos_caja
for select to authenticated
using (
  coalesce(public.auth_activo(), false)
  and (coalesce(public.auth_rol(), '') = 'dueño' or usuario_id = auth.uid())
);

create policy "movimientos_caja_insert_propio" on public.movimientos_caja
for insert to authenticated
with check (coalesce(public.auth_activo(), false) and usuario_id = auth.uid());

-- 8) perfiles: además de "cada uno ve/edita el suyo" (política ya
-- existente desde Núcleo), el dueño necesita poder ver y administrar
-- cualquier perfil — activar/desactivar un operador, cambiarle el rol.
-- Se suma como policy nueva en vez de reemplazar las existentes: varias
-- policies permisivas del mismo comando se combinan con OR, así que un
-- operador (para quien esta condición nunca es true) sigue viendo solo
-- lo suyo por la policy vieja.
create policy "perfiles_dueño_ve_y_administra_todos" on public.perfiles
for all to authenticated
using (coalesce(public.auth_rol(), '') = 'dueño')
with check (coalesce(public.auth_rol(), '') = 'dueño');
