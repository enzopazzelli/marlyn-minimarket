export type MedioPago = "efectivo" | "transferencia" | "qr" | "fiado";

export type ItemCarrito = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

export type PagoCarrito = {
  medio: MedioPago;
  monto: number;
  vuelto: number;
};

export type Venta = {
  id: string;
  numero: number;
  turnoCajaId: string;
  clienteId: string | null;
  usuarioId: string;
  subtotal: number;
  total: number;
  estado: "confirmada" | "anulada";
  creadoEn: string;
};
