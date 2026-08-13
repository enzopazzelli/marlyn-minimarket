export type ItemVentaReporte = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  precioCosto: number;
};

export type PagoVentaReporte = {
  medio: string;
  monto: number;
  vuelto: number;
};

export type VentaReporte = {
  id: string;
  total: number;
  creadoEn: string;
  items: ItemVentaReporte[];
  pagos: PagoVentaReporte[];
};

export type ResumenDia = {
  totalVentas: number;
  cantidadTransacciones: number;
  ticketPromedio: number;
  margenBruto: number;
  ventasPorHora: { hora: number; total: number }[];
  distribucionMedioPago: { medio: string; monto: number; porcentaje: number }[];
  topProductos: { productoId: string; nombre: string; cantidad: number; subtotal: number }[];
};
