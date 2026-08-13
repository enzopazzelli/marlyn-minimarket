import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultadoEliminarProducto = "eliminado" | "marcado_eliminado" | "error";

// Intenta el borrado real primero (funciona para cualquier producto
// sin ventas ni movimientos de stock). ventas_items.producto_id y
// movimientos_stock.producto_id son `not null`, así que un producto
// con historial no se puede borrar sin perder esas filas — ahí cae a
// marcarlo `activo = false` ("eliminado" para el resto de la app, ver
// PanelVentas.tsx/ListaProductos.tsx) en vez de fallar.
export async function eliminarProducto(supabase: SupabaseClient, id: string): Promise<ResultadoEliminarProducto> {
  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (!error) return "eliminado";
  if (error.code !== "23503") return "error";

  const { error: errorSoft } = await supabase.from("productos").update({ activo: false }).eq("id", id);
  return errorSoft ? "error" : "marcado_eliminado";
}
