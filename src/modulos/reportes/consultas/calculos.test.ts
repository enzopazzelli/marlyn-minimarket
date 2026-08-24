import { describe, expect, it } from "vitest";
import { calcularResumenDelDia, hoyISO, limitesDelDia } from "./calculos";
import type { VentaReporte } from "../tipos";

describe("hoyISO", () => {
  it("da la fecha local en formato YYYY-MM-DD", () => {
    expect(hoyISO(new Date(2026, 7, 13, 23, 50))).toBe("2026-08-13");
  });
});

function venta(datos: Partial<VentaReporte>): VentaReporte {
  return {
    id: "v1",
    numero: 1,
    total: 0,
    creadoEn: "2026-08-13T12:00:00.000Z",
    clienteId: null,
    clienteNombre: null,
    items: [],
    pagos: [],
    ...datos,
  };
}

describe("limitesDelDia", () => {
  it("arranca a medianoche y dura exactamente 24 horas", () => {
    const { desde, hasta } = limitesDelDia("2026-08-13");
    expect(new Date(desde).getHours()).toBe(0);
    expect(new Date(hasta).getTime() - new Date(desde).getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("cruza de mes sin problema", () => {
    const { desde, hasta } = limitesDelDia("2026-08-31");
    expect(new Date(hasta).getMonth()).toBe(new Date(desde).getMonth() + 1);
  });
});

describe("calcularResumenDelDia", () => {
  it("sin ventas, todo en cero y listas vacías", () => {
    const resumen = calcularResumenDelDia([]);
    expect(resumen).toEqual({
      totalVentas: 0,
      cantidadTransacciones: 0,
      ticketPromedio: 0,
      margenBruto: 0,
      ventasPorHora: [],
      distribucionMedioPago: [],
      topProductos: [],
    });
  });

  it("calcula ventas, transacciones y ticket promedio", () => {
    const ventas = [
      venta({ total: 1000, pagos: [{ medio: "efectivo", monto: 1000, vuelto: 0 }] }),
      venta({ total: 3000, pagos: [{ medio: "efectivo", monto: 3000, vuelto: 0 }] }),
    ];
    const resumen = calcularResumenDelDia(ventas);
    expect(resumen.totalVentas).toBe(4000);
    expect(resumen.cantidadTransacciones).toBe(2);
    expect(resumen.ticketPromedio).toBe(2000);
  });

  it("un producto vendido en dos ventas distintas se suma en el top", () => {
    const ventas = [
      venta({
        items: [
          {
            productoId: "p1",
            nombre: "Yerba",
            cantidad: 2,
            precioUnitario: 5000,
            precioCosto: 3000,
            subtotal: 10000,
            eliminado: false,
          },
        ],
      }),
      venta({
        items: [
          {
            productoId: "p1",
            nombre: "Yerba",
            cantidad: 3,
            precioUnitario: 5000,
            precioCosto: 3000,
            subtotal: 15000,
            eliminado: false,
          },
        ],
      }),
    ];
    const resumen = calcularResumenDelDia(ventas);
    expect(resumen.topProductos).toEqual([
      { productoId: "p1", nombre: "Yerba", cantidad: 5, subtotal: 25000, eliminado: false },
    ]);
    expect(resumen.margenBruto).toBe(10000); // (5000-3000) * 5
  });

  it("usa subtotal (lo realmente cobrado), no cantidad × precioUnitario — venta por monto con peso fraccionario", () => {
    const ventas = [
      venta({
        items: [
          {
            productoId: "p3",
            nombre: "Jamón crudo",
            cantidad: 0.083333,
            precioUnitario: 18000,
            precioCosto: 12000,
            subtotal: 1500, // cantidad × precioUnitario da 1499.994, no 1500
            eliminado: false,
          },
        ],
      }),
    ];
    const resumen = calcularResumenDelDia(ventas);
    expect(resumen.topProductos[0].subtotal).toBe(1500);
    expect(resumen.margenBruto).toBe(500); // 1500 - 12000×0.083333, redondeado
  });

  it("arrastra 'eliminado' del producto al top", () => {
    const ventas = [
      venta({
        items: [
          {
            productoId: "p2",
            nombre: "Mani suelto",
            cantidad: 1,
            precioUnitario: 100,
            precioCosto: 50,
            subtotal: 100,
            eliminado: true,
          },
        ],
      }),
    ];
    const resumen = calcularResumenDelDia(ventas);
    expect(resumen.topProductos[0].eliminado).toBe(true);
  });

  it("pago mixto dentro de una venta reparte la distribución por medio", () => {
    const ventas = [
      venta({
        total: 3200,
        pagos: [
          { medio: "efectivo", monto: 2000, vuelto: 0 },
          { medio: "transferencia", monto: 1200, vuelto: 0 },
        ],
      }),
    ];
    const resumen = calcularResumenDelDia(ventas);
    expect(resumen.distribucionMedioPago).toEqual([
      { medio: "Efectivo", monto: 2000, porcentaje: 63 },
      { medio: "Transferencia", monto: 1200, porcentaje: 38 },
    ]);
  });

  it("descuenta el vuelto del efectivo antes de repartir por medio", () => {
    const ventas = [
      venta({
        total: 3200,
        pagos: [{ medio: "efectivo", monto: 5000, vuelto: 1800 }],
      }),
    ];
    const resumen = calcularResumenDelDia(ventas);
    expect(resumen.distribucionMedioPago).toEqual([{ medio: "Efectivo", monto: 3200, porcentaje: 100 }]);
  });

  it("agrupa ventas por hora entre la primera y la última del día", () => {
    const ventas = [
      venta({ total: 1000, creadoEn: "2026-08-13T12:30:00.000Z" }),
      venta({ total: 2000, creadoEn: "2026-08-13T14:15:00.000Z" }),
    ];
    const resumen = calcularResumenDelDia(ventas);
    const horas = resumen.ventasPorHora.map((punto) => punto.hora);
    // Rango continuo entre la primera y la última hora con ventas, sin huecos.
    expect(horas).toEqual(Array.from({ length: horas.length }, (_, i) => horas[0] + i));
    expect(resumen.ventasPorHora.reduce((suma, punto) => suma + punto.total, 0)).toBe(3000);
  });
});
