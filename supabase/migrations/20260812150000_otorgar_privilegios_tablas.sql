-- Corrige un default de Supabase que no estaba contemplado al escribir
-- las migraciones anteriores: con "auto_expose_new_tables" en false
-- (supabase/config.toml, comentario de esa clave), las tablas nuevas del
-- schema public no reciben GRANT automático para ningún rol, ni siquiera
-- service_role. Sin esto, la RLS ni se llega a evaluar: PostgREST
-- devuelve "permission denied for table X" (42501) antes de tocar
-- ninguna policy, para cualquier rol — se detectó al probar los tests de
-- RLS de M1 Stock contra el Supabase local.
--
-- anon queda deliberadamente afuera de este grant: nadie sin sesión
-- tiene que poder tocar estas tablas directo (ver rls.test.ts de cada
-- módulo — ese es justo el escenario que prueban).

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on
  public.perfiles,
  public.categorias,
  public.productos,
  public.clientes,
  public.movimientos_cuenta_corriente,
  public.turnos_caja,
  public.movimientos_caja,
  public.ventas,
  public.ventas_items,
  public.ventas_pagos,
  public.movimientos_stock
to authenticated, service_role;

-- Para que los módulos que vengan (M4 Panel, M6 Compras, M7 Reportes...)
-- no repitan este mismo hallazgo: toda tabla nueva en public queda con
-- estos mismos permisos desde el momento en que se crea.
alter default privileges in schema public
grant select, insert, update, delete on tables
to authenticated, service_role;
