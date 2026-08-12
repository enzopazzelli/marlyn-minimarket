-- M2 Clientes: ficha y cuenta corriente simple. Confirmado con el
-- cliente: el fiado se registra, sin límite que bloquee la venta
-- (config/cliente.ts: reglasNegocio.limiteFiadoDuroActivo = false).

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  direccion text,
  -- Positivo = el cliente debe. Se ajusta solo desde registrar_venta()
  -- y anular_venta() (migración de ventas), nunca a mano desde el front.
  saldo_cuenta_corriente numeric(12, 2) not null default 0,
  creado_en timestamptz not null default now()
);

create table public.movimientos_cuenta_corriente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  venta_id uuid, -- FK se agrega en la migración de ventas (todavía no existe esa tabla)
  tipo text not null check (tipo in ('fiado', 'pago')),
  monto numeric(12, 2) not null check (monto > 0),
  nota text,
  creado_por uuid references public.perfiles (id),
  creado_en timestamptz not null default now()
);

alter table public.clientes enable row level security;
alter table public.movimientos_cuenta_corriente enable row level security;

create policy "clientes_acceso_perfil_activo" on public.clientes
for all to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));

create policy "movimientos_cc_acceso_perfil_activo" on public.movimientos_cuenta_corriente
for all to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));

create index movimientos_cc_cliente_idx on public.movimientos_cuenta_corriente (cliente_id);
