-- Fase 0 de PLAN-ROLES-AUDITORIA.md: base de datos para poder auditar
-- "quién hizo qué" antes de construir la pantalla de Auditoría en sí.
--
-- 1) movimientos_caja no guardaba quién hizo un retiro/ingreso manual
--    (sí sabíamos el turno, no la persona). Se agrega la columna y se
--    completa en los 4 lugares que insertan ahí.
-- 2) El motivo de una salida de stock o de una anulación de venta era
--    opcional a nivel base (el front lo pedía, pero nada lo garantizaba
--    si se llamaba la función directo) — si el objetivo es poder
--    auditar por qué bajó el stock o se anuló una venta, un motivo
--    vacío o el genérico por defecto no sirve. Pasa a ser constraint
--    real, no solo de UI (regla 4 del prompt-base).

alter table public.movimientos_caja
  add column usuario_id uuid references public.perfiles (id);

-- registrar_venta(): mismo cuerpo que 20260818100000 (el fix de la
-- columna ambigua), solo se agrega usuario_id al ingreso en efectivo.
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
  v_stock_disponible numeric(12, 3);
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

-- anular_venta(): + motivo obligatorio, + usuario_id en el egreso de caja.
create or replace function public.anular_venta(p_venta_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_pago record;
  v_estado text;
  v_turno_caja_id uuid;
  v_numero bigint;
  v_neto_efectivo numeric(12, 2) := 0;
begin
  if not coalesce(public.auth_activo(), false) then
    raise exception 'No tenés una sesión activa para anular una venta';
  end if;

  if p_motivo is null or trim(p_motivo) = '' then
    raise exception 'Contá el motivo de la anulación';
  end if;

  select estado, turno_caja_id, numero into v_estado, v_turno_caja_id, v_numero
  from public.ventas where id = p_venta_id for update;

  if v_estado is null then
    raise exception 'La venta no existe';
  end if;

  if v_estado = 'anulada' then
    raise exception 'Esa venta ya está anulada';
  end if;

  for v_item in select * from public.ventas_items where venta_id = p_venta_id
  loop
    update public.productos
    set stock_actual = stock_actual + v_item.cantidad,
        actualizado_en = now()
    where id = v_item.producto_id;

    insert into public.movimientos_stock (producto_id, tipo, cantidad, venta_id, usuario_id)
    values (v_item.producto_id, 'anulacion_venta', v_item.cantidad, p_venta_id, auth.uid());
  end loop;

  for v_pago in select * from public.ventas_pagos where venta_id = p_venta_id
  loop
    if v_pago.medio = 'fiado' then
      update public.clientes cl
      set saldo_cuenta_corriente = saldo_cuenta_corriente - v_pago.monto
      from public.ventas v
      where cl.id = v.cliente_id and v.id = p_venta_id;
    elsif v_pago.medio = 'efectivo' then
      v_neto_efectivo := v_neto_efectivo + (v_pago.monto - v_pago.vuelto);
    end if;
  end loop;

  if v_neto_efectivo > 0 then
    insert into public.movimientos_caja (turno_id, tipo, monto, motivo, usuario_id)
    values (v_turno_caja_id, 'egreso', v_neto_efectivo, 'Anulación venta #' || v_numero, auth.uid());
  end if;

  update public.ventas
  set estado = 'anulada',
      anulada_en = now(),
      anulada_por = auth.uid(),
      motivo_anulacion = p_motivo
  where id = p_venta_id;
end;
$$;

-- registrar_movimiento_cuenta_corriente(): + usuario_id en el ingreso
-- de caja que deja un pago cobrado en efectivo.
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

-- registrar_ajuste_stock(): motivo obligatorio en toda salida (rotura,
-- vencido, corrección de conteo — no alcanza con el genérico "Ajuste de
-- stock" si alguien quiere revisar después por qué bajó el stock).
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
