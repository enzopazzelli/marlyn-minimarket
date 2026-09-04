-- Pedido del dueño (2026-09-02): el link de "Pantalla al cliente" tiene
-- que ser el mismo siempre, lo abra el dueño o un colaborador.
--
-- Hoy perfiles.token_pantalla es un token DISTINTO por cada fila —cada
-- dueño y cada colaborador tiene el suyo, `default gen_random_uuid()`
-- en la migración original—, y tanto /pantalla-cliente (que arma el
-- link) como el broadcast al vender (PanelVentas.tsx) usan el token del
-- perfil que está LOGUEADO en ese momento. En un local con más de una
-- persona atendiendo la caja, la TV queda emparejada con el token de
-- quien la emparejó, pero cuando otra persona (con otro usuario) hace
-- una venta, transmite en un canal distinto — la pantalla se queda
-- muda a mitad de turno. El pedido de fondo es real, no un capricho.
--
-- Se saca el token de perfiles y pasa a una tabla de una sola fila
-- ("singleton": boolean primary key con check que solo permite true),
-- para que sea "el token del comercio" y no "el token de tal perfil".
create table public.configuracion_comercio (
  singleton boolean primary key default true check (singleton),
  token_pantalla uuid not null default gen_random_uuid()
);

-- Si ya había algún perfil con un token emparejado de verdad en una TV,
-- se hereda el más viejo (típicamente el primer dueño) para no romper
-- un emparejamiento en uso. Si no había ninguno, uno nuevo.
insert into public.configuracion_comercio (token_pantalla)
select coalesce(
  (select token_pantalla from public.perfiles order by creado_en asc limit 1),
  gen_random_uuid()
);

alter table public.configuracion_comercio enable row level security;

-- Cualquier perfil activo lo lee (lo necesita para armar el link en
-- "Pantalla al cliente" y para el broadcast al vender, sea dueño u
-- operador); nadie lo edita desde la app todavía, no hace falta policy
-- de escritura.
create policy "configuracion_comercio_select_perfil_activo" on public.configuracion_comercio
for select to authenticated
using (coalesce(public.auth_activo(), false));

-- resolver_pantalla() solo devolvía el id del perfil dueño del token
-- para que el front chequeara "¿existe?" (nunca usó el valor en sí, ver
-- PantallaEnVivo.tsx: `setValido(!error && !!data)`) — se mantiene el
-- mismo contrato (uuid o null) para no tocar el front, ahora resuelto
-- contra la tabla nueva en vez de perfiles.
create or replace function public.resolver_pantalla(p_token uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select token_pantalla from public.configuracion_comercio where token_pantalla = p_token
$$;

alter table public.perfiles drop column token_pantalla;
