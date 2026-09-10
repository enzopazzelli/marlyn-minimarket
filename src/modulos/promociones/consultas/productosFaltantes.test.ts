import { describe, expect, it } from "vitest";
import type { ItemCarrito } from "@/modulos/ventas/tipos";
import type { Promocion } from "../tipos";
import { productosFaltantesParaCompletar } from "./productosFaltantes";

function itemUnidad(productoId: string, cantidad: number): ItemCarrito {
  return { productoId, nombre: productoId, cantidad, precioUnitario: 0 };
}

const PROMO_CANTIDAD: Promocion = {
  id: "p1",
  nombre: "3 Alka x 100",
  tipo: "cantidad",
  precioPromocional: 100,
  activa: true,
  items: [{ productoId: "alka", cantidad: 3 }],
};

const PROMO_COMBO: Promocion = {
  id: "p2",
  nombre: "Fernet + Coca",
  tipo: "combo",
  precioPromocional: 19000,
  activa: true,
  items: [
    { productoId: "fernet", cantidad: 1 },
    { productoId: "coca", cantidad: 1 },
  ],
};

describe("productosFaltantesParaCompletar", () => {
  it("dice cuánto falta de un producto para llegar al umbral", () => {
    const resultado = productosFaltantesParaCompletar([itemUnidad("alka", 1)], PROMO_CANTIDAD);
    expect(resultado).toEqual([{ productoId: "alka", cantidad: 2 }]);
  });

  it("vacío si el umbral ya se alcanzó", () => {
    const resultado = productosFaltantesParaCompletar([itemUnidad("alka", 3)], PROMO_CANTIDAD);
    expect(resultado).toEqual([]);
  });

  it("en un combo, solo lista lo que todavía no está en el carrito", () => {
    const resultado = productosFaltantesParaCompletar([itemUnidad("fernet", 1)], PROMO_COMBO);
    expect(resultado).toEqual([{ productoId: "coca", cantidad: 1 }]);
  });

  it("vacío si el combo ya está completo", () => {
    const resultado = productosFaltantesParaCompletar([itemUnidad("fernet", 1), itemUnidad("coca", 1)], PROMO_COMBO);
    expect(resultado).toEqual([]);
  });

  it("con el carrito vacío, falta todo lo que pide la promo", () => {
    const resultado = productosFaltantesParaCompletar([], PROMO_COMBO);
    expect(resultado).toEqual([
      { productoId: "fernet", cantidad: 1 },
      { productoId: "coca", cantidad: 1 },
    ]);
  });
});
