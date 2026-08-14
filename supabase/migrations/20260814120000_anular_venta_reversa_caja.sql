-- anular_venta() devolvía el stock y revertía el fiado, pero nunca
-- tocó movimientos_caja: si la venta anulada se había cobrado en
-- efectivo, ese "ingreso" seguía sumando al arqueo aunque la plata en
-- la práctica se le devuelve al cliente y ya no está en el cajón.
-- Ahora inserta el "egreso" equivalente en el mismo turno de la venta
-- (solo la parte en efectivo neta de vuelto) — mismo criterio que
-- registrar_venta() al registrar el ingreso original. Si el turno de
-- esa venta ya está cerrado, el movimiento igual queda insertado (es
-- lo correcto: la plata efectivamente salió), pero el cierre histórico
-- de ese turno no se recalcula solo — queda desactualizado a propósito,
-- no hay forma de reabrir un arqueo ya hecho.
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
    insert into public.movimientos_caja (turno_id, tipo, monto, motivo)
    values (v_turno_caja_id, 'egreso', v_neto_efectivo, 'Anulación venta #' || v_numero);
  end if;

  update public.ventas
  set estado = 'anulada',
      anulada_en = now(),
      anulada_por = auth.uid(),
      motivo_anulacion = p_motivo
  where id = p_venta_id;
end;
$$;
