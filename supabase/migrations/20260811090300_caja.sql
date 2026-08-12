-- M5 Caja: apertura, cierre, arqueo, movimientos.
--
-- Se crea antes que Ventas porque toda venta necesita un turno abierto
-- para existir (turnos_caja.id es FK de ventas.turno_caja_id) — el
-- orden de las migraciones sigue la dependencia de datos, no
-- necesariamente el orden en que se construyen las pantallas.

create table public.turnos_caja (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id),
  monto_apertura numeric(12, 2) not null default 0 check (monto_apertura >= 0),
  monto_cierre_declarado numeric(12, 2) check (monto_cierre_declarado >= 0),
  monto_cierre_calculado numeric(12, 2),
  estado text not null default 'abierto' check (estado in ('abierto', 'cerrado')),
  abierto_en timestamptz not null default now(),
  cerrado_en timestamptz
);

-- Regla 3 del prompt-base: un invariante de "solo puede haber uno" vive
-- en un índice único, nunca en un select previo al insert — dos clics
-- rápidos, o dos pestañas del mismo usuario, pasarían el chequeo los
-- dos. Es el mismo bug encontrado en CajaController.php de la
-- referencia que mandó el cliente (tvp-minimarket), acá resuelto en la
-- base y no en la aplicación.
create unique index turno_abierto_unico_por_usuario
on public.turnos_caja (usuario_id)
where estado = 'abierto';

create table public.movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos_caja (id) on delete cascade,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  monto numeric(12, 2) not null check (monto > 0),
  motivo text not null,
  creado_en timestamptz not null default now()
);

alter table public.turnos_caja enable row level security;
alter table public.movimientos_caja enable row level security;

create policy "turnos_caja_acceso_perfil_activo" on public.turnos_caja
for all to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));

create policy "movimientos_caja_acceso_perfil_activo" on public.movimientos_caja
for all to authenticated
using (coalesce(public.auth_activo(), false))
with check (coalesce(public.auth_activo(), false));

create index movimientos_caja_turno_idx on public.movimientos_caja (turno_id);
