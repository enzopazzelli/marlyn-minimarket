-- Fase 4 de PLAN-ROLES-AUDITORIA.md: una sola vista que junta "quién
-- hizo qué" de las cinco tablas que ya lo venían guardando (Fase 0/1
-- completaron los huecos que faltaban) — nada de esto se calcula acá,
-- solo se normaliza a columnas comunes para poder listarlo, filtrarlo
-- y ordenarlo por fecha en un solo lugar.
--
-- Dueño-only con su propio where (regla 2: cada vista lleva su propio
-- filtro, no alcanza con que la pantalla la esconda) — security_invoker
-- para que además respete la RLS de cada tabla de abajo (un perfil
-- inactivo sigue sin ver nada, aunque fuera dueño), pero la barrera
-- real es el where de auth_rol() de acá, no la de las tablas: hoy
-- ninguna de esas cinco tablas tiene una policy dueño-only en select
-- (movimientos_stock/movimientos_cuenta_corriente/ventas siguen en
-- "perfil activo" para que el operador pueda operar) — sin este where,
-- el operador vería todo esto igual a través de la vista.
create view public.auditoria_movimientos
with (security_invoker = true)
as
select * from (
  select
    ms.id,
    ms.creado_en as fecha,
    ms.usuario_id,
    case ms.tipo
      when 'venta' then 'stock_venta'
      when 'anulacion_venta' then 'stock_anulacion'
      when 'ingreso' then 'stock_entrada'
      when 'ajuste' then 'stock_salida'
      else 'stock_merma'
    end as tipo,
    p.nombre || coalesce(' — ' || ms.motivo, '') as descripcion,
    ms.cantidad as monto
  from public.movimientos_stock ms
  join public.productos p on p.id = ms.producto_id

  union all

  select
    mcc.id,
    mcc.creado_en as fecha,
    mcc.creado_por as usuario_id,
    case mcc.tipo
      when 'recargo' then 'cta_cte_recargo'
      when 'pago' then 'cta_cte_pago'
      else 'cta_cte_fiado'
    end as tipo,
    c.nombre || coalesce(' — ' || mcc.nota, '') as descripcion,
    mcc.monto
  from public.movimientos_cuenta_corriente mcc
  join public.clientes c on c.id = mcc.cliente_id

  union all

  select
    mc.id,
    mc.creado_en as fecha,
    mc.usuario_id,
    case mc.tipo when 'ingreso' then 'caja_ingreso' else 'caja_egreso' end as tipo,
    mc.motivo as descripcion,
    mc.monto
  from public.movimientos_caja mc

  union all

  select
    v.id,
    v.anulada_en as fecha,
    v.anulada_por as usuario_id,
    'venta_anulada' as tipo,
    'Venta #' || v.numero || coalesce(' — ' || v.motivo_anulacion, '') as descripcion,
    v.total as monto
  from public.ventas v
  where v.estado = 'anulada'

  union all

  -- monto = declarado - calculado: negativo es faltante (la señal más
  -- directa de "algo raro pasó en este turno"), positivo es que sobró.
  select
    tc.id,
    tc.cerrado_en as fecha,
    tc.usuario_id,
    'turno_cierre' as tipo,
    'Cierre de turno' as descripcion,
    coalesce(tc.monto_cierre_declarado, 0) - coalesce(tc.monto_cierre_calculado, 0) as monto
  from public.turnos_caja tc
  where tc.estado = 'cerrado'
) todos
where coalesce(public.auth_rol(), '') = 'dueño';

grant select on public.auditoria_movimientos to authenticated;
