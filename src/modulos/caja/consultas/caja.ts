import type { SupabaseClient } from "@supabase/supabase-js";
import type { TurnoCaja } from "../tipos";

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
