import { describe, expect, it } from "vitest";
import type { ItemCarrito } from "@/modulos/ventas/tipos";
import type { Promocion } from "../tipos";
import { aplicarPromociones } from "./aplicarPromociones";

function itemUnidad(productoId: string, cantidad: number, precioUnitario: number): ItemCarrito {
  return { productoId, nombre: productoId, cantidad, precioUnitario };
}

function promoCantidad(productoId: string, umbral: number, precioPromocional: number, activa = true): Promocion {
  return {
    id: `promo-${productoId}`,
    nombre: `${umbral}x${precioPromocional}`,
    tipo: "cantidad",
    precioPromocional,
    activa,
    items: [{ productoId, cantidad: umbral }],
  };
}

const COMBO_FERNET_COCA: Promocion = {
  id: "combo-1",
  nombre: "Fernet + Coca",
  tipo: "combo",
  precioPromocional: 19000,
  activa: true,
  items: [
    { productoId: "fernet", cantidad: 1 },
    { productoId: "coca", cantidad: 1 },
  ],
};

describe("aplicarPromociones — descuento por cantidad", () => {
  it("no aplica si no se llega al umbral", () => {
    const items = [itemUnidad("alka", 2, 40)];
    const resultado = aplicarPromociones(items, [promoCantidad("alka", 3, 100)]);
    expect(resultado[0]).toBe(items[0]);
    expect(resultado[0].subtotal).toBeUndefined();
  });

  it("aplica el precio de paquete en un múltiplo exacto", () => {
    const items = [itemUnidad("alka", 3, 40)];
    const [resultado] = aplicarPromociones(items, [promoCantidad("alka", 3, 100)]);
    expect(resultado.subtotal).toBe(100);
    expect(resultado.promoAplicada).toEqual({ nombre: "3x100", ahorro: 20 });
  });

  it("cobra el sobrante a precio normal cuando no es múltiplo exacto", () => {
    const items = [itemUnidad("alka", 5, 40)];
    const [resultado] = aplicarPromociones(items, [promoCantidad("alka", 3, 100)]);
    // 1 paquete ($100) + 2 sueltas ($80) = $180; el ahorro es solo el
    // del paquete completo (los 2 sueltos no tienen descuento).
    expect(resultado.subtotal).toBe(180);
    expect(resultado.promoAplicada?.ahorro).toBe(20);
  });

  it("ignora una promo pausada (activa: false)", () => {
    const items = [itemUnidad("alka", 3, 40)];
    const [resultado] = aplicarPromociones(items, [promoCantidad("alka", 3, 100, false)]);
    expect(resultado).toBe(items[0]);
  });

  it("no toca una línea con subtotal ya tipeado a mano (venta por peso)", () => {
    const items: ItemCarrito[] = [
      { productoId: "jamon", nombre: "Jamón", cantidad: 0.083, precioUnitario: 18000, subtotal: 1500 },
    ];
    const promoSobreJamon = promoCantidad("jamon", 1, 100);
    const [resultado] = aplicarPromociones(items, [promoSobreJamon]);
    expect(resultado).toBe(items[0]);
    expect(resultado.subtotal).toBe(1500);
  });

  it("devuelve la misma referencia del array si ninguna promo encaja", () => {
    const items = [itemUnidad("agua", 2, 500)];
    const resultado = aplicarPromociones(items, [promoCantidad("alka", 3, 100)]);
    expect(resultado).toBe(items);
  });
});

describe("aplicarPromociones — combo de productos distintos", () => {
  it("reparte el precio del combo proporcional al precio normal de cada uno, redondeado a peso entero", () => {
    const items = [itemUnidad("fernet", 1, 18000), itemUnidad("coca", 1, 2500)];
    const [fernet, coca] = aplicarPromociones(items, [COMBO_FERNET_COCA]);

    expect(fernet.subtotal).toBe(16683);
    expect(coca.subtotal).toBe(2317);
    // Los dos subtotales tienen que sumar exacto el precio del combo —
    // es lo que efectivamente se cobra, sin importar cómo cae el
    // redondeo de cada línea (el último ítem se lleva el resto).
    expect(fernet.subtotal! + coca.subtotal!).toBe(19000);

    expect(fernet.promoAplicada?.ahorro).toBe(1317);
    expect(coca.promoAplicada?.ahorro).toBe(183);
  });

  it("arma varios combos si el carrito tiene para más de uno", () => {
    const items = [itemUnidad("fernet", 2, 18000), itemUnidad("coca", 2, 2500)];
    const [fernet, coca] = aplicarPromociones(items, [COMBO_FERNET_COCA]);

    expect(fernet.subtotal! + coca.subtotal!).toBe(38000); // 2 × $19.000
  });

  it("deja el sobrante de un producto a precio normal si falta el otro para un segundo combo", () => {
    const items = [itemUnidad("fernet", 1, 18000), itemUnidad("coca", 3, 2500)];
    const [fernet, coca] = aplicarPromociones(items, [COMBO_FERNET_COCA]);

    // 1 combo (limitado por el Fernet) + 2 Coca sueltas a precio normal.
    expect(fernet.subtotal).toBe(16683);
    expect(coca.subtotal).toBe(2317 + 2 * 2500);
    expect(coca.promoAplicada?.ahorro).toBe(183);
  });

  it("no dispara si falta alguno de los productos del combo", () => {
    const items = [itemUnidad("fernet", 1, 18000)];
    const resultado = aplicarPromociones(items, [COMBO_FERNET_COCA]);
    expect(resultado).toBe(items);
  });

  it("combos se resuelven antes que descuentos por cantidad sobre el mismo producto", () => {
    // Alka en un combo con Coca, y también con su propia promo de
    // cantidad — el combo consume primero, la de cantidad mira lo que
    // sobra del pool.
    const comboAlkaCoca: Promocion = {
      id: "combo-2",
      nombre: "Alka + Coca",
      tipo: "combo",
      precioPromocional: 500,
      activa: true,
      items: [
        { productoId: "alka", cantidad: 1 },
        { productoId: "coca", cantidad: 1 },
      ],
    };
    const items = [itemUnidad("alka", 4, 40), itemUnidad("coca", 1, 2500)];
    const [alka] = aplicarPromociones(items, [comboAlkaCoca, promoCantidad("alka", 3, 100)]);

    // El combo usa 1 Alka; quedan 3 Alka sueltas, que sí completan el
    // paquete de 3x$100.
    expect(alka.promoAplicada?.nombre).toContain("Alka + Coca");
    expect(alka.promoAplicada?.nombre).toContain("3x100");
  });
});
