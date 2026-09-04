import { describe, expect, it } from "vitest";
import {
  coincideCodigoExacto,
  contieneCodigo,
  pareceCodigoDeBarras,
  todosLosCodigos,
  validarCodigosAdicionales,
} from "./codigosBarras";

const salsas = { codigoBarras: "7790001", codigosAdicionales: ["7790002", "7790003"] };

describe("todosLosCodigos", () => {
  it("pone el principal primero y después los adicionales", () => {
    expect(todosLosCodigos(salsas)).toEqual(["7790001", "7790002", "7790003"]);
  });

  it("un producto sin código principal devuelve solo los adicionales", () => {
    expect(todosLosCodigos({ codigoBarras: null, codigosAdicionales: ["7790002"] })).toEqual(["7790002"]);
  });

  it("sin ningún código devuelve lista vacía", () => {
    expect(todosLosCodigos({ codigoBarras: null, codigosAdicionales: [] })).toEqual([]);
  });

  it("descarta vacíos y espacios sueltos", () => {
    expect(todosLosCodigos({ codigoBarras: "  7790001 ", codigosAdicionales: ["", "  ", "7790002"] })).toEqual([
      "7790001",
      "7790002",
    ]);
  });
});

describe("coincideCodigoExacto", () => {
  // El caso del pedido: escanear cualquiera de las salsas Arcor tiene
  // que caer en el mismo producto.
  it("encuentra el producto por cualquiera de sus códigos", () => {
    expect(coincideCodigoExacto(salsas, "7790001")).toBe(true);
    expect(coincideCodigoExacto(salsas, "7790003")).toBe(true);
  });

  it("no encuentra por un código que no tiene", () => {
    expect(coincideCodigoExacto(salsas, "7790009")).toBe(false);
  });

  // El lector suele mandar el código con un salto de línea o espacios.
  it("ignora los espacios alrededor del código escaneado", () => {
    expect(coincideCodigoExacto(salsas, "  7790002  ")).toBe(true);
  });

  it("no matchea parcial: 779 no es 7790001", () => {
    expect(coincideCodigoExacto(salsas, "779")).toBe(false);
  });

  it("un código vacío nunca coincide", () => {
    expect(coincideCodigoExacto(salsas, "   ")).toBe(false);
  });
});

describe("contieneCodigo", () => {
  it("matchea parcial contra cualquiera de los códigos", () => {
    expect(contieneCodigo(salsas, "0003")).toBe(true);
    expect(contieneCodigo(salsas, "7790")).toBe(true);
  });

  it("no matchea contra un producto sin códigos", () => {
    expect(contieneCodigo({ codigoBarras: null, codigosAdicionales: [] }, "7790")).toBe(false);
  });
});

describe("validarCodigosAdicionales", () => {
  it("limpia vacíos y espacios de las 5 casillas del formulario", () => {
    expect(validarCodigosAdicionales([" 7790002 ", "", "  ", "7790003", ""], "7790001")).toEqual({
      codigos: ["7790002", "7790003"],
      error: null,
    });
  });

  it("las cinco vacías es válido: el producto queda solo con el principal", () => {
    expect(validarCodigosAdicionales(["", "", "", "", ""], "7790001")).toEqual({ codigos: [], error: null });
  });

  it("rechaza un adicional igual al principal", () => {
    const resultado = validarCodigosAdicionales(["7790001"], "7790001");
    expect(resultado.error).toMatch(/igual al principal/);
  });

  it("rechaza dos adicionales repetidos entre sí", () => {
    const resultado = validarCodigosAdicionales(["7790002", "7790002"], "7790001");
    expect(resultado.error).toMatch(/dos veces/);
  });

  it("acepta hasta 19 adicionales (20 con el principal)", () => {
    const diecinueve = Array.from({ length: 19 }, (_, i) => String(i + 1));
    expect(validarCodigosAdicionales(diecinueve, "0").error).toBeNull();
  });

  it("rechaza el número veinte", () => {
    const veinte = Array.from({ length: 20 }, (_, i) => String(i + 1));
    expect(validarCodigosAdicionales(veinte, "0").error).toMatch(/hasta 19/);
  });

  it("sin código principal, los adicionales no chocan con nada", () => {
    expect(validarCodigosAdicionales(["7790002"], null)).toEqual({ codigos: ["7790002"], error: null });
  });
});

describe("pareceCodigoDeBarras", () => {
  it("una tira de dígitos larga parece un código escaneado", () => {
    expect(pareceCodigoDeBarras("7790001234567")).toBe(true);
    expect(pareceCodigoDeBarras("1234")).toBe(true);
  });

  it("un nombre de producto no parece un código", () => {
    expect(pareceCodigoDeBarras("coca cola")).toBe(false);
    expect(pareceCodigoDeBarras("Fideos")).toBe(false);
  });

  it("números cortos (como buscar '500g') tampoco cuentan como código", () => {
    expect(pareceCodigoDeBarras("500")).toBe(false);
    expect(pareceCodigoDeBarras("1")).toBe(false);
  });

  it("tolera espacios alrededor", () => {
    expect(pareceCodigoDeBarras("  7790001  ")).toBe(true);
  });

  it("vacío no es un código", () => {
    expect(pareceCodigoDeBarras("")).toBe(false);
    expect(pareceCodigoDeBarras("   ")).toBe(false);
  });
});
