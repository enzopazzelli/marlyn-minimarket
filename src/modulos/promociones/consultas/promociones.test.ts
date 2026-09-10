import { describe, expect, it } from "vitest";
import type { PromocionAdmin } from "./promociones";
import { paraAplicarEnVenta } from "./promociones";

function promo(overrides: Partial<PromocionAdmin> = {}): PromocionAdmin {
  return {
    id: "p1",
    nombre: "Promo",
    tipo: "cantidad",
    precioPromocional: 100,
    activa: true,
    items: [{ productoId: "alka", cantidad: 3, nombreProducto: "Alka", precioVenta: 40, productoActivo: true }],
    necesitaRevision: false,
    ...overrides,
  };
}

describe("paraAplicarEnVenta", () => {
  it("incluye una promo activa sin productos eliminados", () => {
    expect(paraAplicarEnVenta([promo()])).toHaveLength(1);
  });

  it("excluye una promo pausada", () => {
    expect(paraAplicarEnVenta([promo({ activa: false })])).toHaveLength(0);
  });

  it("excluye una promo que necesita revisión (producto eliminado)", () => {
    expect(paraAplicarEnVenta([promo({ necesitaRevision: true })])).toHaveLength(0);
  });

  it("no manda los datos de producto que no hacen falta para vender", () => {
    const [resultado] = paraAplicarEnVenta([promo()]);
    expect(resultado.items[0]).toEqual({ productoId: "alka", cantidad: 3 });
  });
});
