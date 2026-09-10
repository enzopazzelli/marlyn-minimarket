-- Módulo de promociones, confirmado por Jason (2026-09-10, audio):
-- "Alka a $40, pero 3 por $100" (descuento por cantidad de un mismo
-- producto) y "Fernet + Coca a un precio conjunto" (combo de productos
-- distintos). Plan completo discutido en PLAN-PROMOCIONES.md (no
-- versionado, gitignoreado).
--
-- promociones_items guarda, para tipo 'cantidad', 1 sola fila (el
-- producto + el umbral de unidades); para tipo 'combo', 2+ filas (una
-- por producto distinto, con la cantidad que pide de cada uno).

create table public.promociones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('cantidad', 'combo')),
  precio_promocional numeric(12, 2) not null check (precio_promocional > 0),
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.promociones_items (
  id uuid primary key default gen_random_uuid(),
  promocion_id uuid not null references public.promociones (id) on delete cascade,
  producto_id uuid not null references public.productos (id) on delete cascade,
  cantidad numeric not null default 1 check (cantidad > 0),
  unique (promocion_id, producto_id)
);

create index promociones_items_promocion_idx on public.promociones_items (promocion_id);
create index promociones_items_producto_idx on public.promociones_items (producto_id);

alter table public.promociones enable row level security;
alter table public.promociones_items enable row level security;

-- Mismo reparto que productos_codigos_barras: el operador necesita LEER
-- las promos activas para que se apliquen solas en /ventas, pero
-- crear/editar/pausar es del dueño.
create policy "promociones_select_perfil_activo" on public.promociones
for select to authenticated
using (coalesce(public.auth_activo(), false));

create policy "promociones_escribe_dueño" on public.promociones
for all to authenticated
using (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño')
with check (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño');

create policy "promociones_items_select_perfil_activo" on public.promociones_items
for select to authenticated
using (coalesce(public.auth_activo(), false));

create policy "promociones_items_escribe_dueño" on public.promociones_items
for all to authenticated
using (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño')
with check (coalesce(public.auth_activo(), false) and coalesce(public.auth_rol(), '') = 'dueño');

-- ============================================================
-- guardar_promocion: alta y edición en un solo llamado (mismo criterio
-- que guardar_codigos_barras_adicionales: reemplaza la lista completa
-- de items, el formulario no sabe cuáles cambiaron). p_id null = alta.
-- ============================================================
create or replace function public.guardar_promocion(
  p_id uuid,
  p_nombre text,
  p_tipo text,
  p_precio_promocional numeric,
  p_activa boolean,
  p_items jsonb -- [{producto_id, cantidad}, ...]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_producto_id uuid;
  v_cantidad numeric;
  v_cantidad_items int;
  v_distintos int;
begin
  if not coalesce(public.auth_activo(), false) then
    raise exception 'No tenés una sesión activa para editar promociones';
  end if;

  if coalesce(public.auth_rol(), '') <> 'dueño' then
    raise exception 'Solo el dueño puede editar promociones';
  end if;

  if p_tipo not in ('cantidad', 'combo') then
    raise exception 'Tipo de promoción inválido';
  end if;

  if p_nombre is null or trim(p_nombre) = '' then
    raise exception 'Escribí un nombre para la promoción';
  end if;

  if p_precio_promocional is null or p_precio_promocional <= 0 then
    raise exception 'El precio de la promoción tiene que ser mayor a cero';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La promoción necesita al menos un producto';
  end if;

  v_cantidad_items := jsonb_array_length(p_items);

  select count(distinct x.producto_id) into v_distintos
  from jsonb_to_recordset(p_items) as x(producto_id uuid, cantidad numeric);

  if v_cantidad_items <> v_distintos then
    raise exception 'No repitas el mismo producto dentro de la misma promoción';
  end if;

  if p_tipo = 'cantidad' and v_distintos <> 1 then
    raise exception 'Una promoción por cantidad necesita exactamente un producto';
  end if;

  if p_tipo = 'combo' and v_distintos < 2 then
    raise exception 'Un combo necesita al menos dos productos distintos';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_cantidad := (v_item ->> 'cantidad')::numeric;

    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'La cantidad de cada producto tiene que ser mayor a cero';
    end if;

    if not exists (select 1 from public.productos where id = v_producto_id) then
      raise exception 'Uno de los productos elegidos no existe';
    end if;
  end loop;

  -- Un producto no puede estar en dos promos "cantidad" activas a la
  -- vez (ambigüedad de cuál paquete aplica en la venta).
  if coalesce(p_activa, true) and p_tipo = 'cantidad' then
    v_producto_id := ((p_items -> 0) ->> 'producto_id')::uuid;

    if exists (
      select 1
      from public.promociones_items pi
      join public.promociones p on p.id = pi.promocion_id
      where pi.producto_id = v_producto_id
        and p.tipo = 'cantidad'
        and p.activa
        and p.id is distinct from p_id
    ) then
      raise exception 'Ese producto ya tiene otra promoción por cantidad activa';
    end if;
  end if;

  if p_id is null then
    insert into public.promociones (nombre, tipo, precio_promocional, activa)
    values (trim(p_nombre), p_tipo, p_precio_promocional, coalesce(p_activa, true))
    returning id into v_id;
  else
    update public.promociones
    set nombre = trim(p_nombre),
        tipo = p_tipo,
        precio_promocional = p_precio_promocional,
        activa = coalesce(p_activa, true)
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'La promoción no existe';
    end if;
  end if;

  delete from public.promociones_items where promocion_id = v_id;

  insert into public.promociones_items (promocion_id, producto_id, cantidad)
  select v_id, x.producto_id, x.cantidad
  from jsonb_to_recordset(p_items) as x(producto_id uuid, cantidad numeric);

  return v_id;
end;
$$;

-- ============================================================
-- activar_promocion: pausar/reactivar sin reenviar los items. Aparte
-- de guardar_promocion (no una escritura directa a la tabla) para que
-- reactivar seguya respetando la regla de "sin solape" de arriba.
-- ============================================================
create or replace function public.activar_promocion(p_id uuid, p_activa boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
  v_producto_id uuid;
begin
  if not coalesce(public.auth_activo(), false) then
    raise exception 'No tenés una sesión activa para editar promociones';
  end if;

  if coalesce(public.auth_rol(), '') <> 'dueño' then
    raise exception 'Solo el dueño puede editar promociones';
  end if;

  select tipo into v_tipo from public.promociones where id = p_id;
  if v_tipo is null then
    raise exception 'La promoción no existe';
  end if;

  if p_activa and v_tipo = 'cantidad' then
    select producto_id into v_producto_id
    from public.promociones_items
    where promocion_id = p_id
    limit 1;

    if v_producto_id is not null and exists (
      select 1
      from public.promociones_items pi
      join public.promociones p on p.id = pi.promocion_id
      where pi.producto_id = v_producto_id
        and p.tipo = 'cantidad'
        and p.activa
        and p.id <> p_id
    ) then
      raise exception 'Ese producto ya tiene otra promoción por cantidad activa';
    end if;
  end if;

  update public.promociones set activa = p_activa where id = p_id;
end;
$$;
