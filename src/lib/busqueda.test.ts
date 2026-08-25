import { describe, expect, it } from "vitest";
import { coincideBusqueda } from "./busqueda";

describe("coincideBusqueda", () => {
  it("caso real del cliente: 'GOM ACID' encuentra 'GOMITA MOGUL ACIDAS-DIENTE'", () => {
    expect(coincideBusqueda("GOMITA MOGUL ACIDAS-DIENTE", "GOM ACID")).toBe(true);
  });

  it("no hace falta que las palabras sean contiguas ni estén en orden", () => {
    expect(coincideBusqueda("Coca Cola 2L", "cola coca")).toBe(true);
  });

  it("cada palabra tiene que aparecer — si una no está, no matchea", () => {
    expect(coincideBusqueda("Coca Cola 2L", "cola fanta")).toBe(false);
  });

  it("case-insensitive", () => {
    expect(coincideBusqueda("Fideos Matarazzo", "FIDEOS")).toBe(true);
  });

  it("término vacío matchea cualquier cosa", () => {
    expect(coincideBusqueda("Lo que sea", "")).toBe(true);
    expect(coincideBusqueda("Lo que sea", "   ")).toBe(true);
  });

  it("espacios repetidos entre palabras no rompen nada", () => {
    expect(coincideBusqueda("Coca Cola 2L", "coca   cola")).toBe(true);
  });
});
