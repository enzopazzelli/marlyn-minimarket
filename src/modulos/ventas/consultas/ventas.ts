import type { SupabaseClient } from "@supabase/supabase-js";
import type { Venta } from "../tipos";

export type VentaResumen = Venta & {
  medioTexto: string;
  clienteNombre: string | null;
};

const ETIQUETA_MEDIO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  qr: "QR",
  fiado: "Fiado",
};

type FilaVenta = {
  id: string;
  numero: number;
  turno_caja_id: string;
  cliente_id: string | null;
  usuario_id: string;
  subtotal: number | string;
  total: number | string;
  estado: Venta["estado"];
  creado_en: string;
  ventas_pagos: { medio: string }[];
  clientes: { nombre: string } | null;
};

// Solo lectura: número, hora, medio(s) de pago y cliente si fue fiado.
// Se usa en /ventas (para ver lo que se va vendiendo) y en /caja (para
// tener el detalle a mano al arquear) — mismo turno, misma consulta.
export async function listarVentasDelTurno(
  supabase: SupabaseClient,
  turnoCajaId: string,
): Promise<VentaResumen[]> {
  const { data, error } = await supabase
    .from("ventas")
    .select(
      "id, numero, turno_caja_id, cliente_id, usuario_id, subtotal, total, estado, creado_en, ventas_pagos(medio), clientes(nombre)",
    )
    .eq("turno_caja_id", turnoCajaId)
    .order("creado_en", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as FilaVenta[]).map((fila) => {
    const medios = [...new Set(fila.ventas_pagos.map((pago) => ETIQUETA_MEDIO[pago.medio] ?? pago.medio))];

    return {
      id: fila.id,
      numero: fila.numero,
      turnoCajaId: fila.turno_caja_id,
      clienteId: fila.cliente_id,
      usuarioId: fila.usuario_id,
      subtotal: Number(fila.subtotal),
      total: Number(fila.total),
      estado: fila.estado,
      creadoEn: fila.creado_en,
      medioTexto: medios.join(" + "),
      clienteNombre: fila.clientes?.nombre ?? null,
    };
  });
}
