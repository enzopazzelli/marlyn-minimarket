-- Saldar cuenta corriente necesita saber cómo se cobró: si fue en
-- efectivo, ese ingreso tiene que quedar en movimientos_caja (igual que
-- ya hace registrar_venta() con cada pago en efectivo), si no el
-- efectivo esperado al cerrar caja no lo contempla. 'recargo' no toca
-- caja nunca, así que no exige ninguno de los dos parámetros nuevos.

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
    insert into public.movimientos_caja (turno_id, tipo, monto, motivo)
    values (p_turno_caja_id, 'ingreso', p_monto, 'Pago cta. cte. — ' || v_nombre_cliente);
  end if;
end;
$$;
