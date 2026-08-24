export type MedioPago = "efectivo" | "transferencia" | "debito" | "credito" | "fiado";

export type ItemCarrito = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  // Override explícito del monto de esta línea (vender por peso a un
  // monto tipeado, ej. "$1500 de jamón") — sin esto, el subtotal es
  // cantidad × precioUnitario como siempre. Necesario porque cantidad
  // solo puede guardar una fracción de kg finita: 1500/18000 = 83,333...g
  // repetido, cantidad × precioUnitario nunca cae justo en $1500 exactos
  // por más precisión que tenga la columna. undefined = sin override
  // (se limpia al volver a editar los gramos a mano).
  subtotal?: number;
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
