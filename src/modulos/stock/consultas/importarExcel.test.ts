import { describe, expect, it } from "vitest";
import { construirImportacion, esCodigoBarrasPlaceholder, normalizarNombre } from "./importarExcel";
import type { FilaExcelCatalogo } from "./importarExcel";

const opciones = { porcentajeGanancia: 30, incluyeIva: false, ivaPorcentaje: 21 };
const sinExistentes = { categorias: [], proveedores: [], codigosBarras: [] };

function fila(datos: Partial<FilaExcelCatalogo>): FilaExcelCatalogo {
  return {
    descripcion: "Producto",
    proveedor: "Proveedor",
    codigoBarra: "7790000000001",
    familia: "Varios",
    costo: 1000,
    ...datos,
  };
}

describe("esCodigoBarrasPlaceholder", () => {
  it("vacío, null y undefined son placeholder", () => {
    expect(esCodigoBarrasPlaceholder("")).toBe(true);
    expect(esCodigoBarrasPlaceholder(null)).toBe(true);
    expect(esCodigoBarrasPlaceholder(undefined)).toBe(true);
  });

  it("un dígito repetido es placeholder (0, 11111111, etc.)", () => {
    expect(esCodigoBarrasPlaceholder("0")).toBe(true);
    expect(esCodigoBarrasPlaceholder(0)).toBe(true);
    expect(esCodigoBarrasPlaceholder("11111111")).toBe(true);
    expect(esCodigoBarrasPlaceholder("44444444444")).toBe(true);
  });

  it("un código real no es placeholder", () => {
    expect(esCodigoBarrasPlaceholder("7790040100336")).toBe(false);
    expect(esCodigoBarrasPlaceholder(7790040100336)).toBe(false);
  });
});

describe("normalizarNombre", () => {
  it("junta mayúscula/minúscula en el mismo resultado", () => {
    expect(normalizarNombre("VARIOS")).toBe(normalizarNombre("Varios"));
    expect(normalizarNombre("varios ")).toBe(normalizarNombre("Varios"));
  });

  it("capitaliza cada palabra y colapsa espacios repetidos", () => {
    expect(normalizarNombre("quita  esmalte")).toBe("Quita Esmalte");
  });
});

describe("construirImportacion", () => {
  it("calcula el precio de venta con la misma fórmula que el alta manual", () => {
    const resumen = construirImportacion([fila({ costo: 1000 })], sinExistentes, opciones);
    expect(resumen.productos[0].precioVenta).toBe(1300); // 1000 * 1.30
  });

  it("código placeholder entra sin código de barras", () => {
    const resumen = construirImportacion([fila({ codigoBarra: "0" })], sinExistentes, opciones);
    expect(resumen.productos[0].codigoBarras).toBeNull();
    expect(resumen.sinCodigoBarras).toBe(1);
  });

  it("saltea una fila cuyo código ya existe en la base", () => {
    const existentes = { ...sinExistentes, codigosBarras: ["7790000000001"] };
    const resumen = construirImportacion([fila({})], existentes, opciones);
    expect(resumen.aImportar).toBe(0);
    expect(resumen.salteadasPorCodigoExistente).toBe(1);
  });

  it("un código real duplicado dentro del archivo solo lo conserva la primera fila", () => {
    const filas = [
      fila({ descripcion: "Primero", codigoBarra: "7790000000002" }),
      fila({ descripcion: "Segundo", codigoBarra: "7790000000002" }),
    ];
    const resumen = construirImportacion(filas, sinExistentes, opciones);
    expect(resumen.aImportar).toBe(2);
    expect(resumen.productos[0].codigoBarras).toBe("7790000000002");
    expect(resumen.productos[1].codigoBarras).toBeNull();
    expect(resumen.sinCodigoBarras).toBe(1);
  });

  it("normaliza rubro y proveedor, y solo cuenta como nuevos los que no existían", () => {
    const filas = [
      fila({ familia: "BEBIDAS", proveedor: "coca cola", codigoBarra: "1" }),
      fila({ familia: "bebidas", proveedor: "Coca Cola", codigoBarra: "2" }),
    ];
    const existentes = { categorias: ["Almacen"], proveedores: [], codigosBarras: [] };
    const resumen = construirImportacion(filas, existentes, opciones);
    expect(resumen.categoriasNuevas).toEqual(["Bebidas"]);
    expect(resumen.proveedoresNuevos).toEqual(["Coca Cola"]);
  });

  it("sin filas, devuelve todo en cero", () => {
    const resumen = construirImportacion([], sinExistentes, opciones);
    expect(resumen).toEqual({
      totalFilas: 0,
      aImportar: 0,
      salteadasPorCodigoExistente: 0,
      sinCodigoBarras: 0,
      categoriasNuevas: [],
      proveedoresNuevos: [],
      productos: [],
    });
  });
});
