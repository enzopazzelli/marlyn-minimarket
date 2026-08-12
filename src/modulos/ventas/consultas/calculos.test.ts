import { describe, expect, it } from "vitest";
import {
  calcularSubtotalItem,
  calcularTotalCarrito,
  calcularTotalCubiertoPorPagos,
  calcularVuelto,
  pagosCubrenElTotal,
} from "./calculos";

describe("calcularSubtotalItem", () => {
  it("multiplica cantidad por precio unitario", () => {
    expect(
      calcularSubtotalItem({ productoId: "1", nombre: "Fideos", cantidad: 3, precioUnitario: 850 }),
    ).toBe(2550);
  });

  it("redondea a centavos", () => {
    expect(
      calcularSubtotalItem({ productoId: "1", nombre: "Queso", cantidad: 0.333, precioUnitario: 10 }),
    ).toBe(3.33);
  });
});

describe("calcularTotalCarrito", () => {
  it("suma varios ítems", () => {
    const items = [
      { productoId: "1", nombre: "Fideos", cantidad: 2, precioUnitario: 850 },
      { productoId: "2", nombre: "Aceite", cantidad: 1, precioUnitario: 1200 },
    ];
    expect(calcularTotalCarrito(items)).toBe(2900);
  });

  it("un carrito vacío da 0", () => {
    expect(calcularTotalCarrito([])).toBe(0);
  });
});

describe("calcularVuelto", () => {
  it("devuelve la diferencia cuando paga de más", () => {
    expect(calcularVuelto(5000, 3200)).toBe(1800);
  });

  it("nunca da negativo si paga justo o de menos", () => {
    expect(calcularVuelto(3200, 3200)).toBe(0);
    expect(calcularVuelto(1000, 3200)).toBe(0);
  });
});

describe("pagosCubrenElTotal / calcularTotalCubiertoPorPagos", () => {
  it("un pago simple en efectivo con vuelto cubre el total", () => {
    const pagos = [{ medio: "efectivo" as const, monto: 5000, vuelto: 1800 }];
    expect(calcularTotalCubiertoPorPagos(pagos)).toBe(3200);
    expect(pagosCubrenElTotal(pagos, 3200)).toBe(true);
  });

  it("un pago mixto (efectivo + transferencia) suma ambos", () => {
    const pagos = [
      { medio: "efectivo" as const, monto: 2000, vuelto: 0 },
      { medio: "transferencia" as const, monto: 1200, vuelto: 0 },
    ];
    expect(pagosCubrenElTotal(pagos, 3200)).toBe(true);
  });

  it("si los pagos no alcanzan, no cubre el total", () => {
    const pagos = [{ medio: "efectivo" as const, monto: 2000, vuelto: 0 }];
    expect(pagosCubrenElTotal(pagos, 3200)).toBe(false);
  });
});
