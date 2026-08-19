import type { SupabaseClient } from "@supabase/supabase-js";
import { hoyISO } from "@/modulos/reportes/consultas/calculos";
import type { MovimientoAuditoria, UsuarioParaFiltro } from "../tipos";

// Función aparte (no inline en un componente/página) a propósito: la
// regla de lint react-hooks/purity no deja llamar Date.now()/new Date()
// directo en el cuerpo de un componente o Server Component — mismo
// motivo por el que hoyISO() (reportes/consultas/calculos.ts) tampoco
// lo hace ahí. Default de la pantalla de Auditoría: últimos 30 días.
export function hace30Dias(): string {
  return hoyISO(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
}

type FilaAuditoria = {
  id: string;
  fecha: string;
  usuario_id: string | null;
  tipo: MovimientoAuditoria["tipo"];
  descripcion: string;
  monto: number | string;
};

// auditoria_movimientos ya viene filtrada a dueño-only por su propio
// where (Fase 4 de PLAN-ROLES-AUDITORIA.md) — acá solo se pide el
// rango de fechas, ordenado por más reciente primero. Tope de 1000
// filas (mismo motivo que traerTodasLasFilas en el resto del
// proyecto: PostgREST corta ahí solo) — con volumen real, un rango
// angosto no debería acercarse a eso; si algún día pasa, esta pantalla
// necesita paginar como ya hace /stock.
export async function listarAuditoria(
  supabase: SupabaseClient,
  desde: string,
  hasta: string,
): Promise<MovimientoAuditoria[]> {
  const { data, error } = await supabase
    .from("auditoria_movimientos")
    .select("id, fecha, usuario_id, tipo, descripcion, monto")
    .gte("fecha", `${desde}T00:00:00`)
    .lte("fecha", `${hasta}T23:59:59.999`)
    .order("fecha", { ascending: false })
    .limit(1000);

  if (error) throw error;

  return ((data ?? []) as FilaAuditoria[]).map((fila) => ({
    id: fila.id,
    fecha: fila.fecha,
    usuarioId: fila.usuario_id,
    tipo: fila.tipo,
    descripcion: fila.descripcion,
    monto: Number(fila.monto),
  }));
}

// Para el filtro "Usuario" del panel — perfiles activos e inactivos
// (un movimiento viejo puede ser de alguien ya desactivado, tiene que
// poder filtrarse igual). Alcanza con la policy de Fase 1
// (perfiles_dueño_ve_y_administra_todos), no hace falta el cliente admin.
export async function listarUsuariosParaFiltro(supabase: SupabaseClient): Promise<UsuarioParaFiltro[]> {
  const { data, error } = await supabase.from("perfiles").select("id, nombre").order("nombre", { ascending: true });

  if (error) throw error;

  return (data ?? []) as UsuarioParaFiltro[];
}
