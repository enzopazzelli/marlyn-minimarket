-- Reportado por el cliente: "cerré sesión y se cerró la caja". Causa
-- real: turnos_caja es privado por usuario (buscarTurnoAbierto()
-- filtra por usuario_id, el índice único solo evita que el MISMO
-- usuario abra dos veces). Si Admin abre la caja y después alguien
-- entra con otra cuenta, esa cuenta no ve el turno de Admin — parece
-- cerrada aunque sigue abierta en la base.
--
-- Confirmado con el cliente: el local tiene un solo cajón físico, la
-- caja tiene que ser compartida entre cualquier usuario activo
-- (incluidos los movimientos que registró otro durante el mismo turno,
-- si no el arqueo da mal). El turno ABIERTO pasa a ser único para todo
-- el local; el historial de turnos CERRADOS sigue siendo privado
-- (operador ve los suyos, dueño ve todos) — eso no cambia.

drop index public.turno_abierto_unico_por_usuario;

-- Índice único parcial sobre una expresión constante: toda fila con
-- estado='abierto' indexa a la misma clave (true), así que como mucho
-- una fila en TODO el local puede tener ese estado, sin importar
-- usuario_id. FormularioAbrirCaja.tsx ya maneja el código 23505 de
-- conflicto — solo cambia qué dispara ese conflicto.
create unique index turno_abierto_unico_global
on public.turnos_caja ((true))
where estado = 'abierto';

drop policy "turnos_caja_select_propio_o_dueño" on public.turnos_caja;

-- El turno abierto es el cajón físico único del local: cualquier
-- usuario activo lo ve y lo opera sin importar quién lo abrió. Los
-- turnos ya CERRADOS siguen siendo historial personal (operador ve los
-- suyos, dueño ve todos) — el índice único de arriba garantiza que
-- "abierto" identifica cuando mucho una fila, así que esta policy
-- nunca expone más de un turno ajeno a la vez a un operador.
create policy "turnos_caja_select_abierto_o_propio_o_dueño" on public.turnos_caja
for select to authenticated
using (
  coalesce(public.auth_activo(), false)
  and (
    estado = 'abierto'
    or coalesce(public.auth_rol(), '') = 'dueño'
    or usuario_id = auth.uid()
  )
);

drop policy "movimientos_caja_select_propio_o_dueño" on public.movimientos_caja;

-- Mismo criterio, pero movimientos_caja no tiene su propia columna
-- estado — el turno "abierto" es un atributo de turnos_caja, así que
-- hace falta el exists() contra esa tabla. Sin esto, calcularEfectivoEsperado()
-- (que suma movimientos_caja a través de la sesión del usuario actual,
-- respetando RLS) seguiría sub-contando lo que registró otro usuario
-- durante el mismo turno compartido.
create policy "movimientos_caja_select_del_abierto_o_propio_o_dueño" on public.movimientos_caja
for select to authenticated
using (
  coalesce(public.auth_activo(), false)
  and (
    coalesce(public.auth_rol(), '') = 'dueño'
    or usuario_id = auth.uid()
    or exists (
      select 1 from public.turnos_caja tc
      where tc.id = movimientos_caja.turno_id and tc.estado = 'abierto'
    )
  )
);
