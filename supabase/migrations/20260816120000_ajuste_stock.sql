-- M1 Stock: "ajustar stock" — una sola función para sumar o restar
-- stock a mano (entrada/salida), reemplazando en pantalla a
-- registrar_ingreso_stock (que sigue existiendo, sin uso desde el
-- front, por si algo más la referenciara). Mismo criterio que toda
-- escritura de stock en este proyecto: nunca un update directo desde
-- el navegador, siempre una función que además deja el movimiento en
-- movimientos_stock (cuya columna `cantidad` ya es signada: "negativo
-- = salida, positivo = entrada", ver 20260811090400_ventas.sql).
--
-- La salida respeta la regla de negocio ya confirmada con el cliente
-- de "sin stock negativo" (reglasNegocio.permiteStockNegativo = false
-- en config/cliente.ts) — bloquea si la cantidad a restar deja el
-- stock por debajo de cero, con el mismo criterio que ya usa
-- registrar_venta indirectamente (ahí no se valida en la función
-- porque el front no deja vender sin stock; acá sí hace falta el check
-- porque un ajuste manual no tiene ese filtro previo).
-- Devuelve el stock resultante (en vez de void): la carga rápida
-- necesita mostrar "cuánto queda" sin disparar otra consulta por cada
-- producto que se ajusta en la misma sesión.
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
