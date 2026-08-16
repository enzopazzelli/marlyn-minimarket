-- Notas sueltas de uso general (pegar el pedido que se le mandó a un
-- proveedor, un recordatorio, lo que haga falta) — pedido explícito de
-- Enzo, 2026-08-14. Sin título ni categoría por ahora: una lista simple
-- de texto libre con fecha, se suma estructura después si hace falta.
-- Mismo patrón que movimientos_caja/turnos_caja: tabla plana con RLS
-- directa, sin función security definer (no hay ningún invariante que
-- proteger más allá del propio check de la columna).
create table public.notas (
  id uuid primary key default gen_random_uuid(),
  texto text not null check (char_length(trim(texto)) > 0),
  creado_por uuid references public.perfiles (id),
  creado_en timestamptz not null default now()
);

alter table public.notas enable row level security;

create policy "notas_acceso_perfil_activo" on public.notas
for all to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));
