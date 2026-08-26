export type Cliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  /** Positivo = el cliente debe. Solo se ajusta desde registrar_venta()
   *  y anular_venta() en la base, nunca a mano desde el front. */
  saldoCuentaCorriente: number;
};

export type MovimientoCuentaCorriente = {
  id: string;
  clienteId: string;
  ventaId: string | null;
  tipo: "fiado" | "pago" | "recargo" | "actualizacion";
  monto: number;
  nota: string | null;
  creadoEn: string;
};
