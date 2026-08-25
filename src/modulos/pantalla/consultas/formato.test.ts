import { describe, expect, it } from "vitest";
import { tamañoTextoItem } from "./formato";

describe("tamañoTextoItem", () => {
  it("un nombre corto usa el tamaño grande de siempre", () => {
    expect(tamañoTextoItem("Coca Cola 2L")).toBe("text-2xl");
  });

  it("caso real del cliente: un nombre largo achica de tamaño", () => {
    expect(tamañoTextoItem("CABALLA AL NATURAL /EN ACEITE Y EN AGUA CARACAS 380GR")).not.toBe("text-2xl");
  });

  it("es monótono: un nombre más largo nunca da una clase más grande", () => {
    const orden = ["text-base", "text-lg", "text-xl", "text-2xl"];
    const corto = orden.indexOf(tamañoTextoItem("Yerba"));
    const largo = orden.indexOf(tamañoTextoItem("Pasta de maní con chips de chocolate blanco y almendras 900g"));
    expect(largo).toBeLessThanOrEqual(corto);
  });
});
