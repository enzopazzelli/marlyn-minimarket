-- Reportado por el cliente: vender por monto ($1500 de jamón a
-- $18000/kg) no cargaba $1500 sino $1494. Causa real: cantidad se
-- guardaba con 3 decimales de kg (numeric(12,3) = gramo entero) —
-- 1500/18000 = 83,333g, redondeado a 83g × $18000 = $1494. El intento
-- anterior solo hacía que el campo de monto MOSTRARA el número real en
-- vez de arreglar el redondeo de fondo.
--
-- Se ensancha la precisión a numeric(14,6) (microgramo — en la
-- práctica nada mide tan fino, es un truco contable para que
-- cantidad × precio reconstruya el monto tipeado hasta el centavo) en
-- las cuatro columnas de cantidad/stock relacionadas. Ensanchar
-- precisión numeric nunca pierde datos existentes.

-- productos_visibles depende de stock_actual/stock_minimo y
-- auditoria_movimientos depende de movimientos_stock.cantidad (rule
-- _RETURN de cada vista) — Postgres no deja alterar el tipo de una
-- columna que una vista referencia directo, así que ambas se recrean
-- alrededor. Mismas definiciones exactas que
-- 20260818120000_rls_rol_operador.sql y 20260818130000_auditoria_vista.sql.
drop view public.auditoria_movimientos;
drop view public.productos_visibles;

alter table public.productos alter column stock_actual type numeric(14, 6);
alter table public.productos alter column stock_minimo type numeric(14, 6);
alter table public.ventas_items alter column cantidad type numeric(14, 6);
alter table public.movimientos_stock alter column cantidad type numeric(14, 6);

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

create view public.auditoria_movimientos
with (security_invoker = true)
as
select * from (
  select
    ms.id,
    ms.creado_en as fecha,
    ms.usuario_id,
    case ms.tipo
      when 'venta' then 'stock_venta'
      when 'anulacion_venta' then 'stock_anulacion'
      when 'ingreso' then 'stock_entrada'
      when 'ajuste' then 'stock_salida'
      else 'stock_merma'
    end as tipo,
    p.nombre || coalesce(' — ' || ms.motivo, '') as descripcion,
    ms.cantidad as monto
  from public.movimientos_stock ms
  join public.productos p on p.id = ms.producto_id

  union all

  select
    mcc.id,
    mcc.creado_en as fecha,
    mcc.creado_por as usuario_id,
    case mcc.tipo
      when 'recargo' then 'cta_cte_recargo'
      when 'pago' then 'cta_cte_pago'
      else 'cta_cte_fiado'
    end as tipo,
    c.nombre || coalesce(' — ' || mcc.nota, '') as descripcion,
    mcc.monto
  from public.movimientos_cuenta_corriente mcc
  join public.clientes c on c.id = mcc.cliente_id

  union all

  select
    mc.id,
    mc.creado_en as fecha,
    mc.usuario_id,
    case mc.tipo when 'ingreso' then 'caja_ingreso' else 'caja_egreso' end as tipo,
    mc.motivo as descripcion,
    mc.monto
  from public.movimientos_caja mc

  union all

  select
    v.id,
    v.anulada_en as fecha,
    v.anulada_por as usuario_id,
    'venta_anulada' as tipo,
    'Venta #' || v.numero || coalesce(' — ' || v.motivo_anulacion, '') as descripcion,
    v.total as monto
  from public.ventas v
  where v.estado = 'anulada'

  union all

  select
    tc.id,
    tc.cerrado_en as fecha,
    tc.usuario_id,
    'turno_cierre' as tipo,
    'Cierre de turno' as descripcion,
    coalesce(tc.monto_cierre_declarado, 0) - coalesce(tc.monto_cierre_calculado, 0) as monto
  from public.turnos_caja tc
  where tc.estado = 'cerrado'
) todos
where coalesce(public.auth_rol(), '') = 'dueño';

grant select on public.auditoria_movimientos to authenticated;

-- registrar_venta() declaraba v_stock_disponible numeric(12, 3) — sin
-- ensanchar esto también, el valor leído de la columna ya ancha se
-- trunca igual al asignarse a la variable. Mismo cuerpo que la versión
-- vigente (20260818110000_auditoria_usuario_caja_y_motivos_obligatorios.sql),
-- solo cambia esa declaración.
create or replace function public.registrar_venta(
  p_turno_caja_id uuid,
  p_cliente_id uuid,
  p_items jsonb,
  p_pagos jsonb
)
returns table (id uuid, numero bigint, creado_en timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_id uuid;
  v_numero bigint;
  v_creado_en timestamptz;
  v_subtotal numeric(12, 2) := 0;
  v_total_pagado numeric(12, 2) := 0;
  v_total_vuelto numeric(12, 2) := 0;
  v_item jsonb;
  v_pago jsonb;
  v_stock_disponible numeric(14, 6);
  v_neto_efectivo numeric(12, 2);
begin
  if not coalesce(public.auth_activo(), false) then
    raise exception 'No tenés una sesión activa para registrar una venta';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos cargados';
  end if;

  if p_pagos is null or jsonb_array_length(p_pagos) = 0 then
    raise exception 'La venta no tiene ningún pago cargado';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select stock_actual into v_stock_disponible
    from public.productos
    where productos.id = (v_item ->> 'producto_id')::uuid
    for update;

    if v_stock_disponible is null then
      raise exception 'El producto % no existe', v_item ->> 'producto_id';
    end if;

    if v_stock_disponible < (v_item ->> 'cantidad')::numeric then
      raise exception 'Quedan % unidades disponibles', v_stock_disponible;
    end if;

    v_subtotal := v_subtotal
      + (v_item ->> 'cantidad')::numeric * (v_item ->> 'precio_unitario')::numeric;
  end loop;

  for v_pago in select * from jsonb_array_elements(p_pagos)
  loop
    v_total_pagado := v_total_pagado + (v_pago ->> 'monto')::numeric;
    v_total_vuelto := v_total_vuelto + coalesce((v_pago ->> 'vuelto')::numeric, 0);
  end loop;

  if (v_total_pagado - v_total_vuelto) <> v_subtotal then
    raise exception 'Los pagos cargados ($%) no cubren el total de la venta ($%)',
      (v_total_pagado - v_total_vuelto), v_subtotal;
  end if;

  insert into public.ventas (turno_caja_id, cliente_id, usuario_id, subtotal, total)
  values (p_turno_caja_id, p_cliente_id, auth.uid(), v_subtotal, v_subtotal)
  returning ventas.id, ventas.numero, ventas.creado_en into v_venta_id, v_numero, v_creado_en;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.ventas_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
    values (
      v_venta_id,
      (v_item ->> 'producto_id')::uuid,
      (v_item ->> 'cantidad')::numeric,
      (v_item ->> 'precio_unitario')::numeric,
      (v_item ->> 'cantidad')::numeric * (v_item ->> 'precio_unitario')::numeric
    );

    update public.productos
    set stock_actual = stock_actual - (v_item ->> 'cantidad')::numeric,
        actualizado_en = now()
    where productos.id = (v_item ->> 'producto_id')::uuid;

    insert into public.movimientos_stock (producto_id, tipo, cantidad, venta_id, usuario_id)
    values (
      (v_item ->> 'producto_id')::uuid,
      'venta',
      -1 * (v_item ->> 'cantidad')::numeric,
      v_venta_id,
      auth.uid()
    );
  end loop;

  for v_pago in select * from jsonb_array_elements(p_pagos)
  loop
    insert into public.ventas_pagos (venta_id, medio, monto, vuelto)
    values (
      v_venta_id,
      v_pago ->> 'medio',
      (v_pago ->> 'monto')::numeric,
      coalesce((v_pago ->> 'vuelto')::numeric, 0)
    );

    if (v_pago ->> 'medio') = 'fiado' then
      if p_cliente_id is null then
        raise exception 'El fiado necesita un cliente asociado a la venta';
      end if;

      update public.clientes
      set saldo_cuenta_corriente = saldo_cuenta_corriente + (v_pago ->> 'monto')::numeric
      where clientes.id = p_cliente_id;

      insert into public.movimientos_cuenta_corriente (cliente_id, venta_id, tipo, monto, creado_por)
      values (p_cliente_id, v_venta_id, 'fiado', (v_pago ->> 'monto')::numeric, auth.uid());
    elsif (v_pago ->> 'medio') = 'efectivo' then
      v_neto_efectivo := (v_pago ->> 'monto')::numeric - coalesce((v_pago ->> 'vuelto')::numeric, 0);

      if v_neto_efectivo > 0 then
        insert into public.movimientos_caja (turno_id, tipo, monto, motivo, usuario_id)
        values (p_turno_caja_id, 'ingreso', v_neto_efectivo, 'Venta #' || v_numero, auth.uid());
      end if;
    end if;
  end loop;

  return query select v_venta_id, v_numero, v_creado_en;
end;
$$;
