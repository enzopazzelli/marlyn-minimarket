import type { ItemCarrito, PagoCarrito } from "../tipos";

/** Funciones puras: sin Supabase ni navegador, para poder testearlas
 *  con Vitest solo (prompt-base sección 7, punto 2). */

export function calcularSubtotalItem(item: ItemCarrito): number {
  return redondearMonto(item.subtotal ?? item.cantidad * item.precioUnitario);
}

export function calcularTotalCarrito(items: ItemCarrito[]): number {
  return redondearMonto(
    items.reduce((acumulado, item) => acumulado + calcularSubtotalItem(item), 0),
  );
}

export function calcularVuelto(montoRecibido: number, totalACobrar: number): number {
  return redondearMonto(Math.max(0, montoRecibido - totalACobrar));
}

/** Suma lo efectivamente cobrado por todos los pagos, descontando el
 *  vuelto entregado en efectivo. Es lo que registrar_venta() en la
 *  base vuelve a validar contra el total — esta función es la versión
 *  del front que decide si el botón "Cobrar" ya puede habilitarse. */
export function calcularTotalCubiertoPorPagos(pagos: PagoCarrito[]): number {
  return redondearMonto(
    pagos.reduce((acumulado, pago) => acumulado + pago.monto - pago.vuelto, 0),
  );
}

export function pagosCubrenElTotal(pagos: PagoCarrito[], total: number): boolean {
  return calcularTotalCubiertoPorPagos(pagos) === total;
}

function redondearMonto(monto: number): number {
  return Math.round(monto * 100) / 100;
}
