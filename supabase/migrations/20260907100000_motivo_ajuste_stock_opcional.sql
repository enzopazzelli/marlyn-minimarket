-- Pedido del dueño (2026-09-07): que el campo "Motivo" de Ajustar
-- stock / Carga rápida ni aparezca, sea entrada o salida. Reversa lo
-- que se había pedido en 20260818110000 —motivo obligatorio en toda
-- salida, para poder auditar después por qué bajó el stock— porque ese
-- detalle ya no les importa.
--
-- Con la exigencia sacada, una salida sin motivo sigue quedando
-- registrada: coalesce(p_motivo, ...) ya tenía el fallback genérico
-- ('Ajuste de stock' / 'Ingreso de mercadería') desde que existe esta
-- función — eso no cambia, solo se saca el bloqueo que impedía guardar
-- sin escribir nada.

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
