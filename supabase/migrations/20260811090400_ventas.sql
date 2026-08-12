-- M3 Ventas/TPV: carrito, pago simple y mixto, anulación con devolución
-- de stock.
--
-- registrar_venta() y anular_venta() son funciones transaccionales:
-- insertan venta + ítems + pagos + descuento de stock (o su reverso)
-- en una sola operación atómica. No se arma paso a paso desde el
-- front, porque eso es exactamente el hueco que tenía VentaController
-- en la referencia del cliente (tvp-minimarket): nada garantizaba que
-- stock, pagos y total quedaran consistentes entre sí si algo fallaba
-- a mitad de camino.

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  turno_caja_id uuid not null references public.turnos_caja (id),
  cliente_id uuid references public.clientes (id),
  usuario_id uuid not null references public.perfiles (id),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  total numeric(12, 2) not null check (total >= 0),
  estado text not null default 'confirmada' check (estado in ('confirmada', 'anulada')),
  anulada_en timestamptz,
  anulada_por uuid references public.perfiles (id),
  motivo_anulacion text,
  creado_en timestamptz not null default now(),
  constraint ventas_numero_unico unique (numero)
);

create table public.ventas_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas (id) on delete cascade,
  producto_id uuid not null references public.productos (id),
  cantidad numeric(12, 3) not null check (cantidad > 0),
  -- Precio congelado al momento de vender: si el producto cambia de
  -- precio después, la venta vieja no se recalcula sola.
  precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0)
);

create table public.ventas_pagos (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas (id) on delete cascade,
  -- Uno o más registros por venta: así sale el pago mixto sin forzar
  -- el modelo a un único campo forma_pago (el cascarón sin implementar
  -- que tenía la referencia del cliente).
  medio text not null check (medio in ('efectivo', 'transferencia', 'qr', 'fiado')),
  monto numeric(12, 2) not null check (monto > 0),
  vuelto numeric(12, 2) not null default 0 check (vuelto >= 0)
);

create table public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id),
  tipo text not null check (tipo in ('venta', 'anulacion_venta', 'ajuste', 'merma')),
  cantidad numeric(12, 3) not null, -- negativo = salida, positivo = entrada
  venta_id uuid references public.ventas (id),
  motivo text,
  usuario_id uuid references public.perfiles (id),
  creado_en timestamptz not null default now()
);

alter table public.movimientos_cuenta_corriente
add constraint movimientos_cc_venta_fk foreign key (venta_id) references public.ventas (id);

alter table public.ventas enable row level security;
alter table public.ventas_items enable row level security;
alter table public.ventas_pagos enable row level security;
alter table public.movimientos_stock enable row level security;

create policy "ventas_acceso_perfil_activo" on public.ventas
for all to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));

create policy "ventas_items_acceso_perfil_activo" on public.ventas_items
for all to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));

create policy "ventas_pagos_acceso_perfil_activo" on public.ventas_pagos
for all to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));

create policy "movimientos_stock_acceso_perfil_activo" on public.movimientos_stock
for all to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));

create index ventas_turno_idx on public.ventas (turno_caja_id);
create index ventas_cliente_idx on public.ventas (cliente_id);
create index ventas_items_venta_idx on public.ventas_items (venta_id);
create index ventas_pagos_venta_idx on public.ventas_pagos (venta_id);
create index movimientos_stock_producto_idx on public.movimientos_stock (producto_id);

-- ============================================================
-- registrar_venta
-- p_items: [{producto_id, cantidad, precio_unitario}, ...]
-- p_pagos: [{medio, monto, vuelto}, ...]
-- ============================================================
create or replace function public.registrar_venta(
  p_turno_caja_id uuid,
  p_cliente_id uuid,
  p_items jsonb,
  p_pagos jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_id uuid;
  v_subtotal numeric(12, 2) := 0;
  v_total_pagado numeric(12, 2) := 0;
  v_total_vuelto numeric(12, 2) := 0;
  v_item jsonb;
  v_pago jsonb;
  v_stock_disponible numeric(12, 3);
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
  returning id into v_venta_id;

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
  -- queda en su historial de cuenta corriente.
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
    end if;
  end loop;

  return v_venta_id;
end;
$$;

-- ============================================================
-- anular_venta: devuelve stock y revierte el fiado si lo hubo.
-- ============================================================
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
begin
  if not coalesce(public.auth_activo(), false) then
    raise exception 'No tenés una sesión activa para anular una venta';
  end if;

  select estado into v_estado from public.ventas where id = p_venta_id for update;

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

  for v_pago in select * from public.ventas_pagos where venta_id = p_venta_id and medio = 'fiado'
  loop
    update public.clientes cl
    set saldo_cuenta_corriente = saldo_cuenta_corriente - v_pago.monto
    from public.ventas v
    where cl.id = v.cliente_id and v.id = p_venta_id;
  end loop;

  update public.ventas
  set estado = 'anulada',
      anulada_en = now(),
      anulada_por = auth.uid(),
      motivo_anulacion = p_motivo
  where id = p_venta_id;
end;
$$;
