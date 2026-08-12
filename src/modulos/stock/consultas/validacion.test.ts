import { describe, expect, it } from "vitest";
import { validarProducto, type DatosProducto } from "./validacion";

const datosValidos: DatosProducto = {
  nombre: "Yerba Playadito 1kg",
  precioCosto: 3000,
  precioVenta: 4200,
  stockActual: 24,
  stockMinimo: 6,
};

describe("validarProducto", () => {
  it("no da errores con datos válidos", () => {
    expect(validarProducto(datosValidos)).toEqual({ valido: true, errores: {} });
  });

  it("exige el nombre", () => {
    const { valido, errores } = validarProducto({ ...datosValidos, nombre: "   " });
    expect(valido).toBe(false);
    expect(errores.nombre).toBe("Escribí el nombre del producto");
  });

  it("no permite precio de venta negativo", () => {
    const { valido, errores } = validarProducto({ ...datosValidos, precioVenta: -1 });
    expect(valido).toBe(false);
    expect(errores.precioVenta).toBe("El precio de venta tiene que ser mayor o igual a cero");
  });

  it("acepta precio de venta en cero", () => {
    expect(validarProducto({ ...datosValidos, precioVenta: 0 }).valido).toBe(true);
  });

  it("no permite precio de costo negativo", () => {
    const { errores } = validarProducto({ ...datosValidos, precioCosto: -1 });
    expect(errores.precioCosto).toBe("El precio de costo no puede ser negativo");
  });

  it("no permite stock actual negativo", () => {
    const { errores } = validarProducto({ ...datosValidos, stockActual: -1 });
    expect(errores.stockActual).toBe("El stock no puede ser negativo");
  });

  it("no permite stock mínimo negativo", () => {
    const { errores } = validarProducto({ ...datosValidos, stockMinimo: -1 });
    expect(errores.stockMinimo).toBe("El mínimo no puede ser negativo");
  });

  it("marca inválido un número no finito (campo vacío convertido con Number())", () => {
    const { valido, errores } = validarProducto({ ...datosValidos, precioVenta: NaN });
    expect(valido).toBe(false);
    expect(errores.precioVenta).toBe("El precio de venta tiene que ser mayor o igual a cero");
  });

  it("acumula todos los errores a la vez", () => {
    const { errores } = validarProducto({
      nombre: "",
      precioCosto: -1,
      precioVenta: -1,
      stockActual: -1,
      stockMinimo: -1,
    });
    expect(Object.keys(errores).sort()).toEqual(
      ["nombre", "precioCosto", "precioVenta", "stockActual", "stockMinimo"].sort(),
    );
  });
});
