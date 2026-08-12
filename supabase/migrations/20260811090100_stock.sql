-- M1 Stock: productos, categorías, alertas de mínimo, código de barras.

create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_en timestamptz not null default now()
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria_id uuid references public.categorias (id),
  codigo_barras text unique,
  precio_costo numeric(12, 2) not null default 0 check (precio_costo >= 0),
  precio_venta numeric(12, 2) not null check (precio_venta >= 0),
  -- Confirmado con el cliente: sin stock cargado no se vende (sección 3,
  -- "permiteStockNegativo" en config/cliente.ts controla esto a futuro).
  stock_actual numeric(12, 3) not null default 0 check (stock_actual >= 0),
  stock_minimo numeric(12, 3) not null default 0 check (stock_minimo >= 0),
  unidad text not null default 'unidad' check (unidad in ('unidad', 'kg', 'litro')),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.categorias enable row level security;
alter table public.productos enable row level security;

-- v1 no diferencia roles todavía: la barrera es "hay sesión y el perfil
-- está activo", ya preparada con auth_activo() para sumar políticas por
-- rol el día que exista el operador (M8), sin reescribir esto.
create policy "categorias_acceso_perfil_activo" on public.categorias
for all to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));

create policy "productos_acceso_perfil_activo" on public.productos
for all to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));

create index productos_codigo_barras_idx on public.productos (codigo_barras);
create index productos_categoria_idx on public.productos (categoria_id);
