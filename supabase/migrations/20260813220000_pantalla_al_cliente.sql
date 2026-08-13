-- Pantalla al cliente en vivo: emparejamiento fijo por dueño (un token
-- que no cambia, sobrevive a abrir/cerrar turnos) resuelto por una
-- función pública — la TV nunca inicia sesión, por diseño (ver
-- src/app/pantalla/[token]/page.tsx). El carrito en sí viaja por
-- Supabase Realtime Broadcast (canal `pantalla:<token>`), no por una
-- tabla: es puramente efímero hasta que registrar_venta() lo confirma.

alter table public.perfiles
  add column token_pantalla uuid not null default gen_random_uuid();

-- Sin auth_activo(): a propósito, esto lo llama un visitante anónimo
-- (la TV del mostrador). Lo único que expone es a qué dueño pertenece
-- un token — nada de datos del negocio pasa por acá, eso va por el
-- canal de Realtime.
create or replace function public.resolver_pantalla(p_token uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.perfiles where token_pantalla = p_token and activo
$$;

grant execute on function public.resolver_pantalla(uuid) to anon;
