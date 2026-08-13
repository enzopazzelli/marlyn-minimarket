-- M1 Stock: proveedores. Mismo formato simple que categorias (rubro) —
-- el catálogo real del cliente (BACKUP.xlsx) trae proveedor por
-- producto y no había dónde guardarlo.

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_en timestamptz not null default now()
);

alter table public.proveedores enable row level security;

create policy "proveedores_acceso_perfil_activo" on public.proveedores
for all to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));

alter table public.productos
  add column proveedor_id uuid references public.proveedores (id);

create index productos_proveedor_idx on public.productos (proveedor_id);
