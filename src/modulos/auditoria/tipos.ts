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
