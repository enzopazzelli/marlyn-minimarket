import { describe, expect, it } from "vitest";
import { resumirActualizacion, type FilaComparacionPrecio } from "./actualizacionPrecios";

function fila(parcial: Partial<FilaComparacionPrecio>): FilaComparacionPrecio {
  return {
    ventaId: "venta-1",
    ventaNumero: 1,
    fiadoEn: "2026-08-20T12:00:00Z",
    productoId: "producto-1",
    producto: "Fideos",
    cantidad: 1,
    precioBase: 1000,
    precioActual: 1000,
    proporcionFiada: 1,
    diferencia: 0,
    ...parcial,
  };
}

describe("resumirActualizacion", () => {
  it("sin filas no hay nada que cobrar", () => {
    expect(resumirActualizacion([])).toEqual({
      productosQueSubieron: 0,
      productosQueBajaron: 0,
      productosSinCambio: 0,
      totalAAplicar: 0,
      totalNetoAPrecioDeHoy: 0,
    });
  });

  it("suma solo las diferencias positivas", () => {
    const resumen = resumirActualizacion([
      fila({ diferencia: 600 }),
      fila({ diferencia: 250.5 }),
      fila({ diferencia: 0 }),
    ]);

    expect(resumen.totalAAplicar).toBe(850.5);
    expect(resumen.productosQueSubieron).toBe(2);
    expect(resumen.productosSinCambio).toBe(1);
  });

  // La decisión del cliente: "solamente le actualizamos el precio si es
  // que sube". Una baja se muestra, pero no descuenta del saldo — por
  // eso los dos totales del resumen no tienen por qué coincidir.
  it("un producto que bajó no descuenta del total a aplicar, pero sí del neto", () => {
    const resumen = resumirActualizacion([fila({ diferencia: 600 }), fila({ diferencia: -200 })]);

    expect(resumen.totalAAplicar).toBe(600);
    expect(resumen.totalNetoAPrecioDeHoy).toBe(400);
    expect(resumen.productosQueBajaron).toBe(1);
  });

  it("si todo bajó, no hay nada para aplicar", () => {
    const resumen = resumirActualizacion([fila({ diferencia: -80 }), fila({ diferencia: -20 })]);

    expect(resumen.totalAAplicar).toBe(0);
    expect(resumen.totalNetoAPrecioDeHoy).toBe(-100);
  });

  it("redondea a centavos al acumular", () => {
    const resumen = resumirActualizacion([
      fila({ diferencia: 0.1 }),
      fila({ diferencia: 0.2 }),
      fila({ diferencia: 0.1 }),
    ]);

    expect(resumen.totalAAplicar).toBe(0.4);
  });
});
