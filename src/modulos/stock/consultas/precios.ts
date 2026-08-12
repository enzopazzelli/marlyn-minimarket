/** Funciones puras: sin Supabase ni navegador, para poder testearlas con
 *  Vitest solo (prompt-base sección 7, punto 2). Calculadora de precio de
 *  venta a partir de costo + % de ganancia + IVA opcional, mismo modelo
 *  que domain/services/pricing_service.py en miadmin: primero se aplica
 *  el margen sobre el costo, después el IVA sobre ese resultado. */

function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

export function calcularPrecioVentaDesdeGanancia(
  precioCosto: number,
  porcentajeGanancia: number,
  incluyeIva: boolean,
  ivaPorcentaje: number,
): number {
  const precioBase = precioCosto * (1 + porcentajeGanancia / 100);
  const precioConIva = incluyeIva ? precioBase * (1 + ivaPorcentaje / 100) : precioBase;
  return redondear(precioConIva, 2);
}

/** Inversa: a partir de lo que se escribió a mano en precio de venta,
 *  reconstruye qué % de ganancia le corresponde. Devuelve null cuando no
 *  se puede repartir (costo en cero o negativo) — el llamador decide
 *  dejar el % como estaba en vez de mostrar un cálculo sin sentido. */
export function calcularGananciaDesdePrecioVenta(
  precioCosto: number,
  precioVenta: number,
  incluyeIva: boolean,
  ivaPorcentaje: number,
): number | null {
  if (!Number.isFinite(precioCosto) || precioCosto <= 0) return null;
  if (!Number.isFinite(precioVenta)) return null;

  const precioBase = incluyeIva ? precioVenta / (1 + ivaPorcentaje / 100) : precioVenta;
  return redondear((precioBase / precioCosto - 1) * 100, 2);
}
