-- Reportado por el cliente, todavía presente después del fix anterior:
-- $1500 de jamón a $18000/kg mostraba $1.499,99 (antes $1494). La
-- migración anterior (20260824110000) ya arregló el redondeo al gramo,
-- pero cantidad × precio_unitario nunca va a caer justo en un monto
-- redondo cuando el peso es fraccionario — 1500/18000 = 83,333...g
-- repetido, ninguna precisión finita lo resuelve exacto.
--
-- El fix de fondo: dejar de derivar el subtotal de cada ítem desde
-- cantidad × precio_unitario en el servidor. El front ya sabe el monto
-- exacto que se tipeó (o, para el resto de los casos, ya calcula
-- cantidad × precio_unitario igual que antes) — ahora lo manda
-- explícito en cada ítem y registrar_venta() lo usa tal cual, mismo
-- nivel de confianza que ya existe hoy para precio_unitario (tampoco
-- se revalida contra el catálogo). cantidad sigue siendo la que
-- efectivamente se descuenta del stock — ahí no cambia nada.

-- Bug encontrado de paso: la migración anterior (20260824140000) le
-- agregó el parámetro p_recargo_monto a registrar_venta() con `create
-- or replace function`, pero eso no reemplaza una función cuando
-- cambia la lista de parámetros — Postgres la trató como una
-- sobrecarga NUEVA y dejó la versión vieja de 4 parámetros viviendo en
-- paralelo. Cualquier llamada que no mandara p_recargo_monto explícito
-- (como calls viejos o de test) quedaba ambigua entre las dos
-- versiones ("Could not choose the best candidate function..."). Se
-- saca la sobrecarga vieja antes de recrear la de 5 parámetros.
drop function if exists public.registrar_venta(uuid, uuid, jsonb, jsonb);

create or replace function public.registrar_venta(
  p_turno_caja_id uuid,
  p_cliente_id uuid,
  p_items jsonb,
  p_pagos jsonb,
  p_recargo_monto numeric default 0
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
  v_total numeric(12, 2) := 0;
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

  if coalesce(p_recargo_monto, 0) < 0 then
    raise exception 'El recargo no puede ser negativo';
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

    v_subtotal := v_subtotal + (v_item ->> 'subtotal')::numeric;
  end loop;

  v_total := v_subtotal + coalesce(p_recargo_monto, 0);

  for v_pago in select * from jsonb_array_elements(p_pagos)
  loop
    v_total_pagado := v_total_pagado + (v_pago ->> 'monto')::numeric;
    v_total_vuelto := v_total_vuelto + coalesce((v_pago ->> 'vuelto')::numeric, 0);
  end loop;

  if (v_total_pagado - v_total_vuelto) <> v_total then
    raise exception 'Los pagos cargados ($%) no cubren el total de la venta ($%)',
      (v_total_pagado - v_total_vuelto), v_total;
  end if;

  insert into public.ventas (turno_caja_id, cliente_id, usuario_id, subtotal, total)
  values (p_turno_caja_id, p_cliente_id, auth.uid(), v_subtotal, v_total)
  returning ventas.id, ventas.numero, ventas.creado_en into v_venta_id, v_numero, v_creado_en;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.ventas_items (venta_id, producto_id, cantidad, precio_unitario, subtotal)
    values (
      v_venta_id,
      (v_item ->> 'producto_id')::uuid,
      (v_item ->> 'cantidad')::numeric,
      (v_item ->> 'precio_unitario')::numeric,
      (v_item ->> 'subtotal')::numeric
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
