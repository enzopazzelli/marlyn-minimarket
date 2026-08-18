-- registrar_venta() devolvía solo el id de la venta. Después de
-- confirmar una venta, /ventas hacía router.refresh() para poder
-- mostrarla en "Ventas de este turno" — eso reejecuta TODA la carga de
-- la página, incluido listarProductos() (el catálogo completo,
-- ~2991 filas paginadas de a 1000). Es la acción que más veces por día
-- se ejecuta en el sistema, pagando el fetch más caro que existe cada
-- vez, para reflejar un cambio de unas pocas filas.
--
-- Devolviendo numero y creado_en además del id, el front puede armar
-- la fila de "Ventas de este turno" de forma optimista (sin volver a
-- pedir nada) en vez de depender de un router.refresh(). El cambio de
-- tipo de retorno (uuid -> table) obliga a un drop primero: Postgres no
-- permite cambiar el tipo de retorno con un simple create or replace.
drop function if exists public.registrar_venta(uuid, uuid, jsonb, jsonb);

create function public.registrar_venta(
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

  -- 1) Validar stock y calcular subtotal ANTES de tocar nada. El
  -- "for update" bloquea la fila del producto: dos ventas simultáneas
  -- del mismo producto no pueden pisarse el stock entre sí.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select stock_actual into v_stock_disponible
    from public.productos
    where id = (v_item ->> 'producto_id')::uuid
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

  -- 2) Los pagos (uno o varios, pago simple o mixto) tienen que cubrir
  -- el total exacto, descontando el vuelto de efectivo.
  for v_pago in select * from jsonb_array_elements(p_pagos)
  loop
    v_total_pagado := v_total_pagado + (v_pago ->> 'monto')::numeric;
    v_total_vuelto := v_total_vuelto + coalesce((v_pago ->> 'vuelto')::numeric, 0);
  end loop;

  if (v_total_pagado - v_total_vuelto) <> v_subtotal then
    raise exception 'Los pagos cargados ($%) no cubren el total de la venta ($%)',
      (v_total_pagado - v_total_vuelto), v_subtotal;
  end if;

  -- 3) Cabecera.
  insert into public.ventas (turno_caja_id, cliente_id, usuario_id, subtotal, total)
  values (p_turno_caja_id, p_cliente_id, auth.uid(), v_subtotal, v_subtotal)
  returning id, numero, creado_en into v_venta_id, v_numero, v_creado_en;

  -- 4) Ítems + descuento de stock + historial de movimiento.
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
    where id = (v_item ->> 'producto_id')::uuid;

    insert into public.movimientos_stock (producto_id, tipo, cantidad, venta_id, usuario_id)
    values (
      (v_item ->> 'producto_id')::uuid,
      'venta',
      -1 * (v_item ->> 'cantidad')::numeric,
      v_venta_id,
      auth.uid()
    );
  end loop;

  -- 5) Pagos. El medio 'fiado' además suma al saldo del cliente y
  -- queda en su historial de cuenta corriente; el medio 'efectivo'
  -- (neto de vuelto) queda en movimientos_caja para poder arquear.
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
      where id = p_cliente_id;

      insert into public.movimientos_cuenta_corriente (cliente_id, venta_id, tipo, monto, creado_por)
      values (p_cliente_id, v_venta_id, 'fiado', (v_pago ->> 'monto')::numeric, auth.uid());
    elsif (v_pago ->> 'medio') = 'efectivo' then
      v_neto_efectivo := (v_pago ->> 'monto')::numeric - coalesce((v_pago ->> 'vuelto')::numeric, 0);

      if v_neto_efectivo > 0 then
        insert into public.movimientos_caja (turno_id, tipo, monto, motivo)
        values (p_turno_caja_id, 'ingreso', v_neto_efectivo, 'Venta #' || v_numero);
      end if;
    end if;
  end loop;

  return query select v_venta_id, v_numero, v_creado_en;
end;
$$;
