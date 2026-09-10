export const CANAL_EVENTO_CARRITO = "carrito";

export function nombreCanalPantalla(token: string): string {
  return `pantalla:${token}`;
}

export type ItemCarritoPantalla = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  // Ausente si la línea es cantidad × precioUnitario tal cual; presente
  // si hay una promo aplicada (o, mismo mecanismo, una venta por peso a
  // monto tipeado) — ver ItemCarritoConPromo/aplicarPromociones.
  subtotal?: number;
  promoAplicada?: { nombre: string; ahorro: number };
};

export type CarritoPantalla = {
  items: ItemCarritoPantalla[];
  total: number;
};
