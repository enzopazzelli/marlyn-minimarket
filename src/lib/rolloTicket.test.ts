import { afterEach, describe, expect, it } from "vitest";
import { guardarAnchoRollo, leerAnchoRollo, medidasRollo, reglaPaginaTicket } from "./rolloTicket";

afterEach(() => {
  window.localStorage.clear();
});

describe("leerAnchoRollo", () => {
  it("sin nada guardado es 80 mm, el rollo más común", () => {
    expect(leerAnchoRollo()).toBe(80);
  });

  it("devuelve lo que se guardó", () => {
    guardarAnchoRollo(58);
    expect(leerAnchoRollo()).toBe(58);
  });

  it("un valor raro guardado (a mano o de otra versión) vuelve a 80", () => {
    window.localStorage.setItem("marlyn:ancho-rollo-ticket", "110");
    expect(leerAnchoRollo()).toBe(80);
  });
});

describe("guardarAnchoRollo", () => {
  it("avisa a los demás componentes abiertos que cambió", () => {
    let avisos = 0;
    const alCambiar = () => avisos++;
    window.addEventListener("ancho-rollo-ticket", alCambiar);
    guardarAnchoRollo(58);
    window.removeEventListener("ancho-rollo-ticket", alCambiar);
    expect(avisos).toBe(1);
  });
});

describe("medidasRollo", () => {
  it("80 mm deja 72 mm imprimibles: 4 mm de margen por lado", () => {
    expect(medidasRollo(80)).toEqual({ anchoMm: 80, margenMm: 4 });
  });

  it("58 mm deja 48 mm imprimibles: 5 mm de margen por lado", () => {
    expect(medidasRollo(58)).toEqual({ anchoMm: 58, margenMm: 5 });
  });
});

describe("reglaPaginaTicket", () => {
  it("la página tiene el ancho del rollo y el alto del ticket en mm", () => {
    // 96 px CSS = 1 pulgada = 25,4 mm → 26 mm
    expect(reglaPaginaTicket(80, 96)).toBe("@page { size: 80mm 26mm; margin: 0; }");
  });

  it("redondea el alto para arriba: un mm de menos manda la última línea a una hoja nueva", () => {
    expect(reglaPaginaTicket(58, 100)).toBe("@page { size: 58mm 27mm; margin: 0; }");
  });
});
