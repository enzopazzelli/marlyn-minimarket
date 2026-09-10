import type { ItemCarrito } from "@/modulos/ventas/tipos";

export type TipoPromocion = "cantidad" | "combo";

export type PromocionItem = {
  productoId: string;
  cantidad: number;
};

/** Forma mínima que necesita aplicarPromociones() — lo que devuelve
 *  listarPromociones() (con nombres/precios de producto para la
 *  administración) la cumple de sobra, así que se usa directo en
 *  /ventas sin mapear a un tipo aparte. */
export type Promocion = {
  id: string;
  nombre: string;
  tipo: TipoPromocion;
  precioPromocional: number;
  activa: boolean;
  items: PromocionItem[];
};

/** ItemCarrito con la promo que terminó cubriendo esta línea, si hubo
 *  alguna — `ahorro` ya viene en pesos, no hace falta recalcularlo en
 *  cada componente que lo muestra (FilaCarritoItem, PantallaEnVivo). */
export type ItemCarritoConPromo = ItemCarrito & {
  promoAplicada?: {
    nombre: string;
    ahorro: number;
  };
};
