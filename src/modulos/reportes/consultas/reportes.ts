import type { SupabaseClient } from "@supabase/supabase-js";
import type { VentaReporte } from "../tipos";
import { limitesDelDia } from "./calculos";

type FilaVentaReporte = {
  id: string;
  numero: number;
  total: number | string;
  creado_en: string;
  cliente_id: string | null;
  clientes: { nombre: string } | null;
  ventas_items: {
    producto_id: string;
    cantidad: number | string;
    precio_unitario: number | string;
    productos: { nombre: string; precio_costo: number | string; activo: boolean } | null;
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
      "id, numero, total, creado_en, cliente_id, clientes(nombre), ventas_items(producto_id, cantidad, precio_unitario, productos(nombre, precio_costo, activo)), ventas_pagos(medio, monto, vuelto)",
    )
    .eq("estado", "confirmada")
    .gte("creado_en", desde)
    .lt("creado_en", hasta)
    .order("creado_en", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as unknown as FilaVentaReporte[]).map((fila) => ({
    id: fila.id,
    numero: fila.numero,
    total: Number(fila.total),
    creadoEn: fila.creado_en,
    clienteId: fila.cliente_id,
    clienteNombre: fila.clientes?.nombre ?? null,
    items: fila.ventas_items.map((item) => ({
      productoId: item.producto_id,
      nombre: item.productos?.nombre ?? "Producto eliminado",
      cantidad: Number(item.cantidad),
      precioUnitario: Number(item.precio_unitario),
      precioCosto: Number(item.productos?.precio_costo ?? 0),
      eliminado: item.productos === null || !item.productos.activo,
    })),
    pagos: fila.ventas_pagos.map((pago) => ({
      medio: pago.medio,
      monto: Number(pago.monto),
      vuelto: Number(pago.vuelto),
    })),
  }));
}
