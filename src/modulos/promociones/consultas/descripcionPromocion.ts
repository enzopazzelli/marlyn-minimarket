import type { Producto } from "@/modulos/stock/tipos";
import type { Promocion } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

function nombreProducto(productos: Producto[], productoId: string): string {
  return productos.find((producto) => producto.id === productoId)?.nombre ?? "producto";
}

/** Frase corta para el aviso ("nube") que aparece al escanear/agregar un
 *  producto que participa de una promo — informa aunque la promo
 *  todavía no se haya completado (ej. escaneás el Fernet solo y ya te
 *  avisa del combo con Coca), para que el cajero pueda ofrecerle al
 *  cliente lo que le falta. Pedido de Jason, 2026-09-11: "que me salga
 *  como una nube... hay una promo, llevando esto o llevando lo otro". */
export function descripcionPromocion(promocion: Promocion, productos: Producto[]): string {
  if (promocion.tipo === "cantidad") {
    const item = promocion.items[0];
    return `Llevando ${item.cantidad} de ${nombreProducto(productos, item.productoId)}, sale ${platita.format(promocion.precioPromocional)}`;
  }

  const nombres = promocion.items.map((item) => {
    const nombre = nombreProducto(productos, item.productoId);
    return item.cantidad > 1 ? `${item.cantidad} ${nombre}` : nombre;
  });
  return `${nombres.join(" + ")} a ${platita.format(promocion.precioPromocional)}`;
}

/** Promos activas donde participa este producto — no filtra por si ya
 *  se completó o no, es justamente para avisar antes de que se
 *  complete. */
export function promocionesDeProducto(promociones: Promocion[], productoId: string): Promocion[] {
  return promociones.filter(
    (promocion) => promocion.activa && promocion.items.some((item) => item.productoId === productoId),
  );
}
