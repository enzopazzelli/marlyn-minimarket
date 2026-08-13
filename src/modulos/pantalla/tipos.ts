export const CANAL_EVENTO_CARRITO = "carrito";

export function nombreCanalPantalla(token: string): string {
  return `pantalla:${token}`;
}

export type ItemCarritoPantalla = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

export type CarritoPantalla = {
  items: ItemCarritoPantalla[];
  total: number;
};
