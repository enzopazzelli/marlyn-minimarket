-- Reportado por el cliente: anuló una venta fiada mixta después de
-- aplicarle dos recargos y registrar un pago — la cuenta corriente
-- quedó con saldo NEGATIVO (como si el negocio le debiera al cliente),
-- porque anular_venta() resta el monto original del fiado del saldo
-- ACTUAL, sin importar qué pasó en el medio.
--
-- saldo_cuenta_corriente es un número corrido, no un historial por
-- venta — no hay forma de "deshacer" un recargo que se calculó sobre
-- una deuda que incluía esta venta, ni de saber si un pago posterior
-- estaba pagando esta deuda u otra. En vez de arriesgar un cálculo
-- automático que puede dar un número sin sentido, se bloquea la
-- anulación si hubo cualquier movimiento de cuenta corriente (recargo,
-- pago, u otro fiado) DESPUÉS del fiado de esta venta — el ajuste
-- queda para hacerlo a mano, con criterio, desde Clientes.

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
  v_fiado_cliente_id uuid;
  v_fiado_creado_en timestamptz;
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

  select cliente_id, creado_en into v_fiado_cliente_id, v_fiado_creado_en
  from public.movimientos_cuenta_corriente
  where venta_id = p_venta_id and tipo = 'fiado'
  limit 1;

  if v_fiado_cliente_id is not null and exists (
    select 1 from public.movimientos_cuenta_corriente
    where cliente_id = v_fiado_cliente_id
      and creado_en > v_fiado_creado_en
  ) then
    raise exception
      'Esta cuenta tuvo un recargo o un pago después de esta venta — no se puede anular sola. Ajustá la cuenta corriente a mano desde Clientes.';
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
