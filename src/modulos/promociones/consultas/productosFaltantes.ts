import type { ItemCarrito } from "@/modulos/ventas/tipos";
import type { Promocion } from "../tipos";

export type ProductoFaltante = {
  productoId: string;
  cantidad: number;
};

/** Funciones puras: sin Supabase ni navegador (prompt-base sección 7,
 *  punto 2), mismo criterio que aplicarPromociones.ts.
 *
 *  Cuánto falta de cada producto de la promo para llegar a una
 *  instancia completa, dado lo que ya hay en el carrito — usado por el
 *  botón "Agregar a la venta" del aviso de promo (pedido de Jason,
 *  2026-09-11: "con un link o botón, se agreguen los productos de la
 *  promo al carrito"). Vacío si la promo ya está completa con lo que
 *  hay cargado. */
export function productosFaltantesParaCompletar(
  itemsCarrito: ItemCarrito[],
  promocion: Promocion,
): ProductoFaltante[] {
  return promocion.items
    .map((item) => {
      const cantidadActual = itemsCarrito.find((i) => i.productoId === item.productoId)?.cantidad ?? 0;
      return { productoId: item.productoId, cantidad: Math.max(0, item.cantidad - cantidadActual) };
    })
    .filter((faltante) => faltante.cantidad > 0);
}
