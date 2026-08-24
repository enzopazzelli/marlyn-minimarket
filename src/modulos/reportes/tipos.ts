export type ItemVentaReporte = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  precioCosto: number;
  // Monto real cobrado por esta línea (columna ventas_items.subtotal) —
  // con peso fraccionario vendido por monto, cantidad × precioUnitario
  // no siempre reconstruye el monto exacto que se cobró.
  subtotal: number;
  // El producto ya no existe en el catálogo activo (borrado con ventas
  // encima, ver eliminarProducto.ts) — el nombre se conserva igual,
  // esto solo marca que ya no se puede volver a vender.
  eliminado: boolean;
};

export type PagoVentaReporte = {
  medio: string;
  monto: number;
  vuelto: number;
};

export type VentaReporte = {
  id: string;
  numero: number;
  total: number;
  creadoEn: string;
  clienteId: string | null;
  clienteNombre: string | null;
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
  topProductos: { productoId: string; nombre: string; cantidad: number; subtotal: number; eliminado: boolean }[];
};
