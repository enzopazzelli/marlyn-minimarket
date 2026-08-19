export type TipoMovimientoAuditoria =
  | "stock_venta"
  | "stock_anulacion"
  | "stock_entrada"
  | "stock_salida"
  | "stock_merma"
  | "cta_cte_recargo"
  | "cta_cte_pago"
  | "cta_cte_fiado"
  | "caja_ingreso"
  | "caja_egreso"
  | "venta_anulada"
  | "turno_cierre";

export type MovimientoAuditoria = {
  id: string;
  fecha: string;
  // null en movimientos de caja de antes de la Fase 0 (no se guardaba
  // usuario_id todavía) — nunca null en movimientos nuevos.
  usuarioId: string | null;
  tipo: TipoMovimientoAuditoria;
  descripcion: string;
  monto: number;
};

export type UsuarioParaFiltro = {
  id: string;
  nombre: string;
};

// Acá y no en el componente: lo necesitan tanto la tabla en pantalla
// (etiqueta + color de la Insignia) como el export a Excel (solo la
// etiqueta) — un solo lugar para no listar los 12 tipos dos veces.
export const INFO_TIPO_AUDITORIA: Record<TipoMovimientoAuditoria, { etiqueta: string; variante: "ok" | "alerta" }> = {
  stock_venta: { etiqueta: "Venta", variante: "ok" },
  stock_entrada: { etiqueta: "Entrada de stock", variante: "ok" },
  stock_salida: { etiqueta: "Salida de stock", variante: "alerta" },
  stock_anulacion: { etiqueta: "Devolución por anulación", variante: "alerta" },
  stock_merma: { etiqueta: "Merma", variante: "alerta" },
  cta_cte_recargo: { etiqueta: "Recargo por atraso", variante: "alerta" },
  cta_cte_pago: { etiqueta: "Pago cta. cte.", variante: "ok" },
  cta_cte_fiado: { etiqueta: "Fiado", variante: "ok" },
  caja_ingreso: { etiqueta: "Ingreso manual de caja", variante: "ok" },
  caja_egreso: { etiqueta: "Retiro manual de caja", variante: "alerta" },
  venta_anulada: { etiqueta: "Venta anulada", variante: "alerta" },
  turno_cierre: { etiqueta: "Cierre de turno", variante: "ok" },
};
