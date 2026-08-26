-- Pedido del cliente (2026-08-26, audio): además del "% de recargo por
-- atraso" que ya existe, una segunda opción abajo — "Actualizar
-- precios". Textual: "hay algunos clientes que son perennes, que vienen
-- siempre y te sacan a la semana y te pagan a la semana; a esos ya no
-- les ponemos porcentaje, sino que solamente le actualizamos el precio
-- si es que sube. Y si hay algunos precios que se hayan actualizado,
-- que tenga otro Excel donde se compare precios como los sacó y
-- precios actualizados a la fecha del sistema."
--
-- O sea: en vez de un % sobre el saldo, recalcular la mercadería que se
-- llevó fiada contra el precio de hoy y cobrar la diferencia. El dato
-- ya está: ventas_items.precio_unitario queda congelado al vender
-- (ver 20260811090400_ventas.sql) y productos.precio_venta es el de hoy.
--
-- Tres decisiones tomadas antes de escribir esto:
--
-- 1) SOLO SUMA LO QUE SUBIÓ. Un producto que bajó de precio aparece en
--    la comparación (informativo) pero no descuenta del saldo — es
--    literal a lo que pidió el dueño y nunca cobra menos de lo pactado
--    al llevarse la mercadería.
--
-- 2) QUÉ FIADOS ENTRAN: los del "ciclo abierto", o sea los posteriores
--    a la última vez que la cuenta quedó en cero o a favor. Es
--    exactamente el ciclo del cliente perenne (saca toda la semana,
--    paga el sábado, arranca de nuevo). saldo_cuenta_corriente es un
--    número corrido, no un historial por venta (ver 20260825110000...),
--    así que el corte se reconstruye sumando los movimientos en orden.
--    Los fiados de ventas anuladas se excluyen de esa suma:
--    anular_venta() baja el saldo pero deja la fila del movimiento
--    donde estaba, así que sin ese filtro el saldo reconstruido no
--    coincidiría con el real.
--
-- 3) NO SE COBRA DOS VECES. Cada actualización guarda en `detalle` el
--    precio al que dejó cada producto; la siguiente toma ese precio
--    como base en vez del precio original de la venta. Solo avanzan de
--    base las filas que efectivamente se cobraron (diferencia > 0) — si
--    un producto bajó y no se cobró nada, su base sigue siendo la
--    original, para que una suba posterior no cobre de más.

alter table public.movimientos_cuenta_corriente drop constraint movimientos_cuenta_corriente_tipo_check;
alter table public.movimientos_cuenta_corriente add constraint movimientos_cuenta_corriente_tipo_check
  check (tipo in ('fiado', 'pago', 'recargo', 'actualizacion'));

-- Snapshot de la comparación que originó el movimiento. Solo lo usa
-- 'actualizacion'; el resto de los tipos lo deja en null.
alter table public.movimientos_cuenta_corriente add column detalle jsonb;

-- ============================================================
-- calcular_actualizacion_precios_fiado
-- Read-only: la misma cuenta que muestra la pantalla antes de aplicar y
-- la que usa el Excel de comparación. registrar_actualizacion_...() la
-- vuelve a llamar en el momento de aplicar, así el monto no viaja desde
-- el front (mismo criterio que registrar_venta con el total).
--
-- Dueño-only con su propio chequeo, no solo escondido en la pantalla:
-- misma regla que la vista auditoria_movimientos.
-- ============================================================
create or replace function public.calcular_actualizacion_precios_fiado(p_cliente_id uuid)
returns table (
  venta_id uuid,
  venta_numero bigint,
  fiado_en timestamptz,
  producto_id uuid,
  producto text,
  cantidad numeric,
  precio_base numeric,
  precio_actual numeric,
  proporcion_fiada numeric,
  diferencia numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with permiso as (
    select coalesce(public.auth_activo(), false)
       and coalesce(public.auth_rol(), '') = 'dueño' as ok
  ),
  movimientos as (
    select
      m.id,
      m.creado_en,
      m.tipo,
      m.monto,
      m.venta_id,
      case when m.tipo = 'pago' then -m.monto else m.monto end as monto_con_signo
    from public.movimientos_cuenta_corriente m
    left join public.ventas v on v.id = m.venta_id
    cross join permiso
    where permiso.ok
      and m.cliente_id = p_cliente_id
      -- el fiado de una venta anulada ya no está en el saldo
      and (m.tipo <> 'fiado' or coalesce(v.estado, 'confirmada') = 'confirmada')
  ),
  corrido as (
    select
      m.*,
      row_number() over (order by m.creado_en, m.id) as orden,
      sum(m.monto_con_signo) over (order by m.creado_en, m.id) as saldo
    from movimientos m
  ),
  -- último movimiento que dejó la cuenta al día (o a favor); 0 si nunca
  -- pasó, y entonces entran todos los fiados que haya.
  corte as (
    select coalesce(max(orden), 0) as orden from corrido where saldo <= 0
  ),
  abiertos as (
    select c.venta_id, c.creado_en, c.monto
    from corrido c
    cross join corte
    where c.tipo = 'fiado' and c.orden > corte.orden
  ),
  -- Precio al que quedó cada producto en la última actualización que
  -- efectivamente lo cobró.
  base_previa as (
    select distinct on ((d ->> 'venta_id')::uuid, (d ->> 'producto_id')::uuid)
      (d ->> 'venta_id')::uuid as venta_id,
      (d ->> 'producto_id')::uuid as producto_id,
      (d ->> 'precio_actual')::numeric as precio
    from public.movimientos_cuenta_corriente m
    cross join lateral jsonb_array_elements(m.detalle) as d
    where m.cliente_id = p_cliente_id
      and m.tipo = 'actualizacion'
      and m.detalle is not null
      and (d ->> 'diferencia')::numeric > 0
    order by (d ->> 'venta_id')::uuid, (d ->> 'producto_id')::uuid, m.creado_en desc
  )
  select
    a.venta_id,
    v.numero,
    a.creado_en,
    vi.producto_id,
    p.nombre,
    vi.cantidad,
    coalesce(bp.precio, vi.precio_unitario) as precio_base,
    p.precio_venta as precio_actual,
    -- En una venta mixta (parte efectivo, parte fiado) solo se actualiza
    -- la fracción que quedó fiada.
    case when v.total > 0 then least(round(a.monto / v.total, 4), 1) else 1 end as proporcion_fiada,
    round(
      vi.cantidad
        * (p.precio_venta - coalesce(bp.precio, vi.precio_unitario))
        * case when v.total > 0 then least(round(a.monto / v.total, 4), 1) else 1 end,
      2
    ) as diferencia
  from abiertos a
  join public.ventas v on v.id = a.venta_id
  join public.ventas_items vi on vi.venta_id = a.venta_id
  join public.productos p on p.id = vi.producto_id
  left join base_previa bp on bp.venta_id = a.venta_id and bp.producto_id = vi.producto_id
  order by a.creado_en, p.nombre;
$$;

-- ============================================================
-- registrar_actualizacion_precios_fiado
-- Aplica la diferencia como un movimiento 'actualizacion' y devuelve el
-- monto aplicado. Igual que 'recargo': solo el dueño, y nunca toca caja
-- (no entró plata, subió lo que el cliente debe).
-- ============================================================
create or replace function public.registrar_actualizacion_precios_fiado(p_cliente_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(12, 2);
  v_productos int;
  v_detalle jsonb;
begin
  if not coalesce(public.auth_activo(), false) then
    raise exception 'No tenés una sesión activa para registrar este movimiento';
  end if;

  if coalesce(public.auth_rol(), '') <> 'dueño' then
    raise exception 'Solo el dueño puede actualizar los precios de un fiado';
  end if;

  select
    coalesce(round(sum(f.diferencia) filter (where f.diferencia > 0), 2), 0),
    count(*) filter (where f.diferencia > 0),
    coalesce(jsonb_agg(to_jsonb(f) order by f.fiado_en), '[]'::jsonb)
  into v_total, v_productos, v_detalle
  from public.calcular_actualizacion_precios_fiado(p_cliente_id) f;

  if v_total <= 0 then
    raise exception 'No hay ningún precio que haya subido desde que se llevó la mercadería';
  end if;

  update public.clientes
  set saldo_cuenta_corriente = saldo_cuenta_corriente + v_total
  where id = p_cliente_id;

  if not found then
    raise exception 'El cliente no existe';
  end if;

  insert into public.movimientos_cuenta_corriente (cliente_id, tipo, monto, nota, detalle, creado_por)
  values (
    p_cliente_id,
    'actualizacion',
    v_total,
    'Actualización de precios — ' || v_productos || ' producto' || case when v_productos = 1 then '' else 's' end,
    v_detalle,
    auth.uid()
  );

  return v_total;
end;
$$;

-- La vista de auditoría mapeaba los tipos de cuenta corriente con un
-- `else` que caía en fiado: sin este cambio, una actualización de
-- precios aparecería listada como "Fiado".
create or replace view public.auditoria_movimientos
with (security_invoker = true)
as
select * from (
  select
    ms.id,
    ms.creado_en as fecha,
    ms.usuario_id,
    case ms.tipo
      when 'venta' then 'stock_venta'
      when 'anulacion_venta' then 'stock_anulacion'
      when 'ingreso' then 'stock_entrada'
      when 'ajuste' then 'stock_salida'
      else 'stock_merma'
    end as tipo,
    p.nombre || coalesce(' — ' || ms.motivo, '') as descripcion,
    ms.cantidad as monto
  from public.movimientos_stock ms
  join public.productos p on p.id = ms.producto_id

  union all

  select
    mcc.id,
    mcc.creado_en as fecha,
    mcc.creado_por as usuario_id,
    case mcc.tipo
      when 'recargo' then 'cta_cte_recargo'
      when 'pago' then 'cta_cte_pago'
      when 'actualizacion' then 'cta_cte_actualizacion'
      else 'cta_cte_fiado'
    end as tipo,
    c.nombre || coalesce(' — ' || mcc.nota, '') as descripcion,
    mcc.monto
  from public.movimientos_cuenta_corriente mcc
  join public.clientes c on c.id = mcc.cliente_id

  union all

  select
    mc.id,
    mc.creado_en as fecha,
    mc.usuario_id,
    case mc.tipo when 'ingreso' then 'caja_ingreso' else 'caja_egreso' end as tipo,
    mc.motivo as descripcion,
    mc.monto
  from public.movimientos_caja mc

  union all

  select
    v.id,
    v.anulada_en as fecha,
    v.anulada_por as usuario_id,
    'venta_anulada' as tipo,
    'Venta #' || v.numero || coalesce(' — ' || v.motivo_anulacion, '') as descripcion,
    v.total as monto
  from public.ventas v
  where v.estado = 'anulada'

  union all

  -- monto = declarado - calculado: negativo es faltante (la señal más
  -- directa de "algo raro pasó en este turno"), positivo es que sobró.
  select
    tc.id,
    tc.cerrado_en as fecha,
    tc.usuario_id,
    'turno_cierre' as tipo,
    'Cierre de turno' as descripcion,
    coalesce(tc.monto_cierre_declarado, 0) - coalesce(tc.monto_cierre_calculado, 0) as monto
  from public.turnos_caja tc
  where tc.estado = 'cerrado'
) todos
where coalesce(public.auth_rol(), '') = 'dueño';
