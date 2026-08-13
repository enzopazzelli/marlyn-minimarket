import type { SupabaseClient } from "@supabase/supabase-js";
import type { MovimientoCaja, TurnoCaja } from "../tipos";

type FilaTurno = {
  id: string;
  usuario_id: string;
  monto_apertura: number | string;
  monto_cierre_declarado: number | string | null;
  monto_cierre_calculado: number | string | null;
  estado: TurnoCaja["estado"];
  abierto_en: string;
  cerrado_en: string | null;
};

// El índice único parcial (turno_abierto_unico_por_usuario, migración
// de Caja) es la barrera real de "un usuario, un turno abierto a la
// vez" — esto solo lee cuál es, si existe.
export async function buscarTurnoAbierto(
  supabase: SupabaseClient,
  usuarioId: string,
): Promise<TurnoCaja | null> {
  const { data, error } = await supabase
    .from("turnos_caja")
    .select(
      "id, usuario_id, monto_apertura, monto_cierre_declarado, monto_cierre_calculado, estado, abierto_en, cerrado_en",
    )
    .eq("usuario_id", usuarioId)
    .eq("estado", "abierto")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const fila = data as FilaTurno;
  return {
    id: fila.id,
    usuarioId: fila.usuario_id,
    montoApertura: Number(fila.monto_apertura),
    montoCierreDeclarado: fila.monto_cierre_declarado === null ? null : Number(fila.monto_cierre_declarado),
    montoCierreCalculado: fila.monto_cierre_calculado === null ? null : Number(fila.monto_cierre_calculado),
    estado: fila.estado,
    abiertoEn: fila.abierto_en,
    cerradoEn: fila.cerrado_en,
  };
}

// Apertura + movimientos del turno (ingresos suman, egresos restan).
// Desde 20260813180000, registrar_venta() deja un 'ingreso' acá por
// cada pago en efectivo (neto de vuelto) — sin eso no habría con qué
// comparar el efectivo contado al cerrar.
export async function calcularEfectivoEsperado(
  supabase: SupabaseClient,
  turnoId: string,
  montoApertura: number,
): Promise<number> {
  const { data, error } = await supabase.from("movimientos_caja").select("tipo, monto").eq("turno_id", turnoId);

  if (error) throw error;

  const neto = (data ?? []).reduce((suma, movimiento) => {
    const monto = Number(movimiento.monto);
    return suma + (movimiento.tipo === "egreso" ? -monto : monto);
  }, 0);

  return montoApertura + neto;
}

type FilaMovimientoCaja = {
  id: string;
  turno_id: string;
  tipo: MovimientoCaja["tipo"];
  monto: number | string;
  motivo: string;
  creado_en: string;
};

// El detalle de calcularEfectivoEsperado, para poder verlo: cada venta
// en efectivo ("Venta #N") y, desde esta migración, cada pago de cuenta
// corriente cobrado en efectivo ("Pago cta. cte. — Nombre").
export async function listarMovimientosCaja(supabase: SupabaseClient, turnoId: string): Promise<MovimientoCaja[]> {
  const { data, error } = await supabase
    .from("movimientos_caja")
    .select("id, turno_id, tipo, monto, motivo, creado_en")
    .eq("turno_id", turnoId)
    .order("creado_en", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as FilaMovimientoCaja[]).map((fila) => ({
    id: fila.id,
    turnoId: fila.turno_id,
    tipo: fila.tipo,
    monto: Number(fila.monto),
    motivo: fila.motivo,
    creadoEn: fila.creado_en,
  }));
}
