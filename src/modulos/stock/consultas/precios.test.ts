import { describe, expect, it } from "vitest";
import { calcularGananciaDesdePrecioVenta, calcularPrecioVentaDesdeGanancia } from "./precios";

const IVA = 21;

describe("calcularPrecioVentaDesdeGanancia", () => {
  it("aplica el margen sobre el costo sin IVA", () => {
    expect(calcularPrecioVentaDesdeGanancia(1000, 30, false, IVA)).toBe(1300);
  });

  it("suma el IVA arriba del precio con margen cuando incluyeIva es true", () => {
    // 1000 * 1.30 = 1300; 1300 * 1.21 = 1573
    expect(calcularPrecioVentaDesdeGanancia(1000, 30, true, IVA)).toBe(1573);
  });

  it("con 0% de ganancia y sin IVA, el precio de venta es el costo", () => {
    expect(calcularPrecioVentaDesdeGanancia(1000, 0, false, IVA)).toBe(1000);
  });

  it("redondea a centavos", () => {
    expect(calcularPrecioVentaDesdeGanancia(10, 33.333, false, IVA)).toBe(13.33);
  });
});

describe("calcularGananciaDesdePrecioVenta", () => {
  it("es la inversa de calcularPrecioVentaDesdeGanancia sin IVA", () => {
    expect(calcularGananciaDesdePrecioVenta(1000, 1300, false, IVA)).toBe(30);
  });

  it("es la inversa de calcularPrecioVentaDesdeGanancia con IVA", () => {
    expect(calcularGananciaDesdePrecioVenta(1000, 1573, true, IVA)).toBe(30);
  });

  it("da null si el costo es cero o negativo (no se puede repartir)", () => {
    expect(calcularGananciaDesdePrecioVenta(0, 1000, false, IVA)).toBeNull();
    expect(calcularGananciaDesdePrecioVenta(-5, 1000, false, IVA)).toBeNull();
  });

  it("da 0 cuando el precio de venta es igual al costo", () => {
    expect(calcularGananciaDesdePrecioVenta(1000, 1000, false, IVA)).toBe(0);
  });
});
