-- Núcleo: perfiles de usuario y función de rol reutilizable por toda
-- política RLS del sistema.
--
-- Regla 1 (prompt-base sección 6): toda función security definer
-- compara de forma NULL-safe. auth_rol()/auth_activo() devuelven null
-- cuando no hay perfil (usuario recién creado, o sin sesión), y quien
-- las use SIEMPRE envuelve la comparación en coalesce(..., false).

create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  rol text not null default 'dueño' check (rol in ('dueño', 'operador')),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table public.perfiles enable row level security;

create or replace function public.auth_rol()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid()
$$;

create or replace function public.auth_activo()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select activo from public.perfiles where id = auth.uid()), false)
$$;

-- Un perfil solo ve y edita el suyo propio. Gestionar perfiles ajenos
-- (alta de operadores) queda para M8, fuera de esta entrega: hoy los
-- dos únicos usuarios son los dueños, con el mismo nivel de acceso.
create policy "perfiles_select_propio" on public.perfiles
for select to authenticated
using (id = auth.uid());

create policy "perfiles_update_propio" on public.perfiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Alta de perfil automática al crear el usuario en auth.users, para no
-- depender de un segundo paso manual después del alta.
create or replace function public.gestionar_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.gestionar_usuario_nuevo();
