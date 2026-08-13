-- M2 Clientes: recargo manual sobre fiado atrasado. El dueño decide el
-- % caso por caso (no es una fórmula automática por días) y el sistema
-- calcula el total — "para no hacer líos" fue el pedido textual del
-- cliente.

alter table public.movimientos_cuenta_corriente drop constraint movimientos_cuenta_corriente_tipo_check;
alter table public.movimientos_cuenta_corriente add constraint movimientos_cuenta_corriente_tipo_check
  check (tipo in ('fiado', 'pago', 'recargo'));

-- ============================================================
-- registrar_movimiento_cuenta_corriente
-- 'recargo' suma al saldo (el cliente pasa a deber más), 'pago' resta.
-- 'fiado' sigue siendo exclusivo de registrar_venta() -- acá no se
-- acepta, para no abrir una segunda puerta a cargar deuda sin que haya
-- una venta real detrás.
-- ============================================================
create or replace function public.registrar_movimiento_cuenta_corriente(
  p_cliente_id uuid,
  p_tipo text,
  p_monto numeric,
  p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  update public.clientes
  set saldo_cuenta_corriente = saldo_cuenta_corriente
    + (case when p_tipo = 'recargo' then p_monto else -p_monto end)
  where id = p_cliente_id;

  if not found then
    raise exception 'El cliente no existe';
  end if;

  insert into public.movimientos_cuenta_corriente (cliente_id, tipo, monto, nota, creado_por)
  values (p_cliente_id, p_tipo, p_monto, p_nota, auth.uid());
end;
$$;
