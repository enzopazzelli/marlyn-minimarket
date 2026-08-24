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

function mapearTurno(fila: FilaTurno): TurnoCaja {
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

// El cajón es uno solo para todo el local: el índice único parcial
// (turno_abierto_unico_global, migración 20260824120000) es la barrera
// real de "como mucho un turno abierto a la vez, sin importar quién lo
// abrió" — esto solo lee cuál es, si existe.
export async function buscarTurnoAbierto(supabase: SupabaseClient): Promise<TurnoCaja | null> {
  const { data, error } = await supabase
    .from("turnos_caja")
    .select(
      "id, usuario_id, monto_apertura, monto_cierre_declarado, monto_cierre_calculado, estado, abierto_en, cerrado_en",
    )
    .eq("estado", "abierto")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapearTurno(data as FilaTurno);
}

// Historial de cierres (pedido explícito de Enzo, 2026-08-14 — ya
// prometido al cliente como parte del plan). montoCierreCalculado y
// montoCierreDeclarado quedan congelados en la fila desde
// FormularioCerrarCaja.tsx, así que acá no hace falta recalcular nada
// como en calcularEfectivoEsperado — es una lectura directa. No filtra
// por usuario: los dos dueños comparten el mismo nivel de acceso, así
// que cualquiera puede revisar el historial completo del local.
export async function listarTurnosCerrados(supabase: SupabaseClient, limite = 30): Promise<TurnoCaja[]> {
  const { data, error } = await supabase
    .from("turnos_caja")
    .select(
      "id, usuario_id, monto_apertura, monto_cierre_declarado, monto_cierre_calculado, estado, abierto_en, cerrado_en",
    )
    .eq("estado", "cerrado")
    .order("cerrado_en", { ascending: false })
    .limit(limite);

  if (error) throw error;

  return ((data ?? []) as FilaTurno[]).map(mapearTurno);
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
