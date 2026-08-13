-- create or replace no reemplaza una función cuando cambia la firma de
-- parámetros — Postgres la trata como un overload nuevo, no un
-- reemplazo. La migración anterior dejó dos versiones de
-- registrar_movimiento_cuenta_corriente coexistiendo (la vieja de 4
-- parámetros y la nueva de 6), y PostgREST no puede elegir cuál llamar
-- ("Could not choose the best candidate function"). Se saca la firma
-- vieja.
drop function if exists public.registrar_movimiento_cuenta_corriente(uuid, text, numeric, text);
