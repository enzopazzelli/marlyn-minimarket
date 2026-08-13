import type { SupabaseClient } from "@supabase/supabase-js";
import type { VentaReporte } from "../tipos";
import { limitesDelDia } from "./calculos";

type FilaVentaReporte = {
  id: string;
  total: number | string;
  creado_en: string;
  ventas_items: {
    producto_id: string;
    cantidad: number | string;
    precio_unitario: number | string;
    productos: { nombre: string; precio_costo: number | string } | null;
  }[];
  ventas_pagos: { medio: string; monto: number | string; vuelto: number | string }[];
};

// 'fecha' en formato "YYYY-MM-DD". Solo ventas confirmadas (una anulada
// no debería pesar en ningún indicador del día).
export async function obtenerVentasDelDia(supabase: SupabaseClient, fecha: string): Promise<VentaReporte[]> {
  const { desde, hasta } = limitesDelDia(fecha);

  const { data, error } = await supabase
    .from("ventas")
    .select(
      "id, total, creado_en, ventas_items(producto_id, cantidad, precio_unitario, productos(nombre, precio_costo)), ventas_pagos(medio, monto, vuelto)",
    )
    .eq("estado", "confirmada")
    .gte("creado_en", desde)
    .lt("creado_en", hasta)
    .order("creado_en", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as FilaVentaReporte[]).map((fila) => ({
    id: fila.id,
    total: Number(fila.total),
    creadoEn: fila.creado_en,
    items: fila.ventas_items.map((item) => ({
      productoId: item.producto_id,
      nombre: item.productos?.nombre ?? "Producto eliminado",
      cantidad: Number(item.cantidad),
      precioUnitario: Number(item.precio_unitario),
      precioCosto: Number(item.productos?.precio_costo ?? 0),
    })),
    pagos: fila.ventas_pagos.map((pago) => ({
      medio: pago.medio,
      monto: Number(pago.monto),
      vuelto: Number(pago.vuelto),
    })),
  }));
}
