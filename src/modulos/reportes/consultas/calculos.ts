import type { ResumenDia, VentaReporte } from "../tipos";

/** Funciones puras: sin Supabase ni navegador, para poder testearlas
 *  con Vitest solo (mismo criterio que ventas/consultas/calculos.ts). */

const ETIQUETA_MEDIO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  fiado: "Fiado",
};

// "Hoy" en formato "YYYY-MM-DD", en horario local (mismo criterio que el
// resto de la app: BarraSuperior.tsx arma la fecha mostrada sin forzar
// ninguna zona horaria explícita). Recibe la fecha para poder testearla
// con un valor fijo.
export function hoyISO(fecha: Date = new Date()): string {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

// 'fecha' en formato "YYYY-MM-DD", tomado como día local (mismo criterio
// que el resto de la app: BarraSuperior.tsx ya arma "hoy" sin forzar
// ninguna zona horaria explícita).
export function limitesDelDia(fecha: string): { desde: string; hasta: string } {
  const inicio = new Date(`${fecha}T00:00:00`);
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 1);
  return { desde: inicio.toISOString(), hasta: fin.toISOString() };
}

export function calcularResumenDelDia(ventas: VentaReporte[]): ResumenDia {
  const totalVentas = redondear(ventas.reduce((suma, venta) => suma + venta.total, 0));
  const cantidadTransacciones = ventas.length;
  const ticketPromedio = cantidadTransacciones > 0 ? redondear(totalVentas / cantidadTransacciones) : 0;

  // Margen bruto con el precio_costo ACTUAL de cada producto: no hay un
  // histórico de costo por venta, así que si el costo cambió después de
  // vender, el balance de hoy ya refleja el costo nuevo (documentado en
  // el README junto a los demás supuestos). Ingreso = item.subtotal (lo
  // que realmente se cobró esa línea), no cantidad × precioUnitario —
  // con peso fraccionario vendido por monto no siempre coinciden.
  const margenBruto = redondear(
    ventas.reduce(
      (suma, venta) =>
        suma + venta.items.reduce((sub, item) => sub + item.subtotal - item.precioCosto * item.cantidad, 0),
      0,
    ),
  );

  const ventasPorHora = calcularVentasPorHora(ventas);
  const distribucionMedioPago = calcularDistribucionMedioPago(ventas, totalVentas);
  const topProductos = calcularTopProductos(ventas);

  return { totalVentas, cantidadTransacciones, ticketPromedio, margenBruto, ventasPorHora, distribucionMedioPago, topProductos };
}

function calcularVentasPorHora(ventas: VentaReporte[]): ResumenDia["ventasPorHora"] {
  const porHora = new Map<number, number>();
  for (const venta of ventas) {
    const hora = new Date(venta.creadoEn).getHours();
    porHora.set(hora, (porHora.get(hora) ?? 0) + venta.total);
  }
  if (porHora.size === 0) return [];

  const horas = [...porHora.keys()].sort((a, b) => a - b);
  const primeraHora = horas[0];
  const ultimaHora = horas[horas.length - 1];

  return Array.from({ length: ultimaHora - primeraHora + 1 }, (_, indice) => {
    const hora = primeraHora + indice;
    return { hora, total: redondear(porHora.get(hora) ?? 0) };
  });
}

function calcularDistribucionMedioPago(
  ventas: VentaReporte[],
  totalVentas: number,
): ResumenDia["distribucionMedioPago"] {
  const porMedio = new Map<string, number>();
  for (const venta of ventas) {
    for (const pago of venta.pagos) {
      // Neto de vuelto: `monto` es lo que el cliente entregó, no lo que
      // efectivamente pagó (mismo criterio que el descuento de vuelto en
      // registrar_venta() al acreditar movimientos_caja).
      const neto = pago.monto - pago.vuelto;
      porMedio.set(pago.medio, (porMedio.get(pago.medio) ?? 0) + neto);
    }
  }

  return [...porMedio.entries()]
    .map(([medio, monto]) => ({
      medio: ETIQUETA_MEDIO[medio] ?? medio,
      monto: redondear(monto),
      porcentaje: totalVentas > 0 ? Math.round((monto / totalVentas) * 100) : 0,
    }))
    .sort((a, b) => b.monto - a.monto);
}

function calcularTopProductos(ventas: VentaReporte[]): ResumenDia["topProductos"] {
  const porProducto = new Map<string, { nombre: string; cantidad: number; subtotal: number; eliminado: boolean }>();
  for (const venta of ventas) {
    for (const item of venta.items) {
      const acumulado = porProducto.get(item.productoId) ?? {
        nombre: item.nombre,
        cantidad: 0,
        subtotal: 0,
        eliminado: item.eliminado,
      };
      acumulado.cantidad += item.cantidad;
      acumulado.subtotal = redondear(acumulado.subtotal + item.subtotal);
      porProducto.set(item.productoId, acumulado);
    }
  }

  return [...porProducto.entries()]
    .map(([productoId, datos]) => ({ productoId, ...datos }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);
}

function redondear(monto: number): number {
  return Math.round(monto * 100) / 100;
}
