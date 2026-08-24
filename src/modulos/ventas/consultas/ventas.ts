import type { SupabaseClient } from "@supabase/supabase-js";
import type { Venta } from "../tipos";

export type VentaResumen = Venta & {
  medioTexto: string;
  clienteNombre: string | null;
};

const PLATITA = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

const ETIQUETA_MEDIO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
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
  ventas_pagos: { medio: string; monto: number | string; vuelto: number | string }[];
  clientes: { nombre: string } | null;
};

// Con más de un pago (mixta, o fiado parcial), cuánto fue de cada medio
// — pedido explícito del cliente, 2026-08-24, mismo criterio que
// medioTextoConMontos() en reportes/componentes/TablaDetalleVentas.tsx:
// "Efectivo $2.000 + Transferencia $1.500" en vez de solo las
// etiquetas. Neto de vuelto (lo que efectivamente queda acreditado a
// ese medio, no lo que el cliente entregó en mano).
function medioTexto(pagos: FilaVenta["ventas_pagos"]): string {
  if (pagos.length <= 1) {
    return pagos.map((pago) => ETIQUETA_MEDIO[pago.medio] ?? pago.medio).join(" + ");
  }
  return pagos
    .map((pago) => {
      const neto = Number(pago.monto) - Number(pago.vuelto);
      return `${ETIQUETA_MEDIO[pago.medio] ?? pago.medio} ${PLATITA.format(neto)}`;
    })
    .join(" + ");
}

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
      "id, numero, turno_caja_id, cliente_id, usuario_id, subtotal, total, estado, creado_en, ventas_pagos(medio, monto, vuelto), clientes(nombre)",
    )
    .eq("turno_caja_id", turnoCajaId)
    .order("creado_en", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as FilaVenta[]).map((fila) => {
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
      medioTexto: medioTexto(fila.ventas_pagos),
      clienteNombre: fila.clientes?.nombre ?? null,
    };
  });
}
