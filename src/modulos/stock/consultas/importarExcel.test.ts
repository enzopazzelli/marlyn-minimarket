import { describe, expect, it } from "vitest";
import {
  aNumero,
  construirImportacion,
  construirImportacionDesdePlantilla,
  detectarFormato,
  esCodigoBarrasPlaceholder,
  normalizarNombre,
  normalizarUnidad,
} from "./importarExcel";
import type { FilaExcelCatalogo, FilaExcelPlantilla } from "./importarExcel";

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

describe("detectarFormato", () => {
  const plantilla = [
    "Código de barras", "Producto", "Rubro", "Proveedor",
    "Precio costo", "Precio venta", "Stock actual", "Stock mínimo", "Unidad",
  ];
  const catalogo = ["Descripcion", "Proveedor", "Codigo de barra", "Familia", "Costo"];

  it("reconoce la plantilla del sistema aunque tenga acentos y mayúsculas", () => {
    expect(detectarFormato(plantilla)).toEqual({ formato: "plantilla", faltantes: [] });
  });

  it("reconoce el export del sistema anterior", () => {
    expect(detectarFormato(catalogo)).toEqual({ formato: "catalogo", faltantes: [] });
  });

  it("las columnas de stock son opcionales en la plantilla", () => {
    const sinStock = plantilla.filter((c) => !c.startsWith("Stock"));
    expect(detectarFormato(sinStock)).toEqual({ formato: "plantilla", faltantes: [] });
  });

  // El motivo de existir de esta función: el error tiene que decir qué
  // columna agregar, no "el archivo no sirve".
  it("dice exactamente qué columnas faltan", () => {
    const { formato, faltantes } = detectarFormato(["Producto", "Rubro", "Precio venta"]);
    expect(formato).toBe("plantilla");
    expect(faltantes).toEqual(["codigo de barras", "proveedor", "precio costo", "unidad"]);
  });
});

describe("aNumero", () => {
  it("acepta números tal cual", () => {
    expect(aNumero(1200)).toBe(1200);
    expect(aNumero(0)).toBe(0);
  });

  it("acepta el formato de moneda que escribe el cliente", () => {
    expect(aNumero("$1.234,56")).toBe(1234.56);
    expect(aNumero("1234.56")).toBe(1234.56);
    expect(aNumero(" 980 ")).toBe(980);
  });

  it("devuelve null para texto que no es un número, y para vacío", () => {
    expect(aNumero("1.200 pesos")).toBeNull();
    expect(aNumero("s/d")).toBeNull();
    expect(aNumero("")).toBeNull();
    expect(aNumero(null)).toBeNull();
    expect(aNumero(undefined)).toBeNull();
  });

  it("desenvuelve las celdas con fórmula de exceljs", () => {
    expect(aNumero({ formula: "A1*2", result: 500 })).toBe(500);
  });
});

describe("normalizarUnidad", () => {
  it("mapea las variantes que escribe el cliente", () => {
    expect(normalizarUnidad("Unidad")).toBe("unidad");
    expect(normalizarUnidad("U")).toBe("unidad");
    expect(normalizarUnidad("KG")).toBe("kg");
    expect(normalizarUnidad("Kilo")).toBe("kg");
    expect(normalizarUnidad("Litros")).toBe("litro");
  });

  it("vacío cae en unidad, que es el default de la tabla", () => {
    expect(normalizarUnidad("")).toBe("unidad");
    expect(normalizarUnidad(null)).toBe("unidad");
  });

  it("null para cualquier otra cosa, para poder rechazar la fila", () => {
    expect(normalizarUnidad("docena")).toBeNull();
    expect(normalizarUnidad("gramos")).toBeNull();
  });
});

describe("construirImportacionDesdePlantilla", () => {
  const sinNada = { categorias: [], proveedores: [], codigosBarras: [] };

  function fila(parcial: Partial<FilaExcelPlantilla> = {}): FilaExcelPlantilla {
    return {
      numeroFila: 2,
      producto: "COCA COLA 2L",
      rubro: "Bebidas sin Alcohol",
      proveedor: "Coca Cola",
      codigoBarra: "7790000000001",
      precioCosto: 1000,
      precioVenta: 1500,
      stockActual: 0,
      stockMinimo: 0,
      unidad: "Unidad",
      ...parcial,
    };
  }

  it("usa el precio de venta del archivo, sin calcular margen", () => {
    const resumen = construirImportacionDesdePlantilla([fila()], sinNada);
    expect(resumen.aImportar).toBe(1);
    expect(resumen.productos[0].precioVenta).toBe(1500);
    expect(resumen.productos[0].precioCosto).toBe(1000);
    expect(resumen.productos[0].unidad).toBe("unidad");
  });

  // Lo pedido explícitamente: lo que no tiene información queda vacío,
  // no se inventa un rubro "Sin rubro" ni un proveedor con nombre "".
  it("rubro y proveedor vacíos quedan vacíos y no crean maestros", () => {
    const resumen = construirImportacionDesdePlantilla([fila({ rubro: "", proveedor: "" })], sinNada);
    expect(resumen.productos[0].categoriaNombre).toBe("");
    expect(resumen.productos[0].proveedorNombre).toBe("");
    expect(resumen.categoriasNuevas).toEqual([]);
    expect(resumen.proveedoresNuevos).toEqual([]);
    expect(resumen.sinRubro).toBe(1);
    expect(resumen.sinProveedor).toBe(1);
  });

  it("código de barras vacío o placeholder queda en null", () => {
    const resumen = construirImportacionDesdePlantilla(
      [fila({ codigoBarra: "" }), fila({ numeroFila: 3, codigoBarra: "0000" })],
      sinNada,
    );
    expect(resumen.productos.map((p) => p.codigoBarras)).toEqual([null, null]);
    expect(resumen.sinCodigoBarras).toBe(2);
  });

  it("precio costo y stock mínimo vacíos quedan en cero", () => {
    const resumen = construirImportacionDesdePlantilla([fila({ precioCosto: "", stockMinimo: "" })], sinNada);
    expect(resumen.productos[0].precioCosto).toBe(0);
    expect(resumen.productos[0].stockMinimo).toBe(0);
  });

  // El error que el cliente reportó dos veces: un precio escrito como
  // texto. Tiene que salir con fila y producto, no reventar el import.
  it("rechaza la fila cuyo precio es texto, y sigue con las demás", () => {
    const resumen = construirImportacionDesdePlantilla(
      [fila({ numeroFila: 2, precioVenta: "1.200 pesos" }), fila({ numeroFila: 3, producto: "PAN" })],
      sinNada,
    );
    expect(resumen.aImportar).toBe(1);
    expect(resumen.productos[0].nombre).toBe("PAN");
    expect(resumen.rechazadas).toEqual([
      { numeroFila: 2, producto: "COCA COLA 2L", motivo: "Precio venta no es un número" },
    ]);
  });

  it("rechaza una unidad que no existe en la base", () => {
    const resumen = construirImportacionDesdePlantilla([fila({ unidad: "docena" })], sinNada);
    expect(resumen.aImportar).toBe(0);
    expect(resumen.rechazadas[0].motivo).toContain("no es unidad, kg ni litro");
  });

  // El stock es estado derivado: solo lo mueven las funciones que dejan
  // su fila en movimientos_stock. Se cuenta para poder avisarlo.
  it("no importa el stock del archivo, pero cuenta las filas que lo traen", () => {
    const resumen = construirImportacionDesdePlantilla(
      [fila({ stockActual: 7 }), fila({ numeroFila: 3, stockActual: 0, codigoBarra: "7790000000002" })],
      sinNada,
    );
    expect(resumen.conStockEnElArchivo).toBe(1);
    expect(Object.keys(resumen.productos[0])).not.toContain("stockActual");
  });

  it("saltea el producto cuyo código ya existe en la base", () => {
    const resumen = construirImportacionDesdePlantilla([fila()], {
      ...sinNada,
      codigosBarras: ["7790000000001"],
    });
    expect(resumen.aImportar).toBe(0);
    expect(resumen.salteadasPorCodigoExistente).toBe(1);
  });

  it("dos filas con el mismo código: la segunda entra sin código", () => {
    const resumen = construirImportacionDesdePlantilla(
      [fila(), fila({ numeroFila: 3, producto: "OTRO" })],
      sinNada,
    );
    expect(resumen.aImportar).toBe(2);
    expect(resumen.productos[0].codigoBarras).toBe("7790000000001");
    expect(resumen.productos[1].codigoBarras).toBeNull();
  });
});

describe("normalizarNombre con conectores", () => {
  it("no capitaliza los conectores del medio", () => {
    expect(normalizarNombre("GOLOSINAS Y CHOCOLATES")).toBe("Golosinas y Chocolates");
    expect(normalizarNombre("bebidas sin alcohol")).toBe("Bebidas sin Alcohol");
    expect(normalizarNombre("FERRETERIA Y ELECTRONICA")).toBe("Ferreteria y Electronica");
  });

  it("la primera palabra se capitaliza aunque sea un conector", () => {
    expect(normalizarNombre("de la costa")).toBe("De la Costa");
  });

  it("sigue juntando las variantes de mayúsculas en un solo nombre", () => {
    expect(normalizarNombre("DULCES Y MERMELADAS")).toBe(normalizarNombre("dulces y mermeladas"));
  });
});
