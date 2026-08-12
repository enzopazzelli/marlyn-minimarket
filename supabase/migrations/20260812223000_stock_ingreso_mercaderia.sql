-- M1 Stock: "ingresar mercadería" — sumar stock a un producto ya
-- cargado, con motivo, en vez de editarlo a mano. Coherente con cómo ya
-- se maneja la venta/anulación: el stock cambia solo por movimientos
-- registrados en movimientos_stock, nunca por un update directo desde
-- el front (por eso 'editar producto' no toca stock_actual).

alter table public.movimientos_stock drop constraint movimientos_stock_tipo_check;
alter table public.movimientos_stock add constraint movimientos_stock_tipo_check
  check (tipo in ('venta', 'anulacion_venta', 'ajuste', 'merma', 'ingreso'));

-- ============================================================
-- registrar_ingreso_stock
-- Suma cantidad a stock_actual, actualiza precio_venta si se pasó uno
-- nuevo, y deja el movimiento con motivo. Todo en una función para que
-- las dos escrituras (productos + movimientos_stock) sean atómicas —
-- mismo criterio que registrar_venta/anular_venta.
-- ============================================================
create or replace function public.registrar_ingreso_stock(
  p_producto_id uuid,
  p_cantidad numeric,
  p_precio_venta_nuevo numeric default null,
  p_motivo text default 'Ingreso de mercadería'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(public.auth_activo(), false) then
    raise exception 'No tenés una sesión activa para ingresar mercadería';
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad tiene que ser mayor a cero';
  end if;

  update public.productos
  set stock_actual = stock_actual + p_cantidad,
      precio_venta = coalesce(p_precio_venta_nuevo, precio_venta),
      actualizado_en = now()
  where id = p_producto_id;

  if not found then
    raise exception 'El producto no existe';
  end if;

  insert into public.movimientos_stock (producto_id, tipo, cantidad, motivo, usuario_id)
  values (p_producto_id, 'ingreso', p_cantidad, p_motivo, auth.uid());
end;
$$;
