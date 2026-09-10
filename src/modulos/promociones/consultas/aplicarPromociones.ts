import type { ItemCarrito } from "@/modulos/ventas/tipos";
import type { ItemCarritoConPromo, Promocion } from "../tipos";

/** Funciones puras: sin Supabase ni navegador (prompt-base sección 7,
 *  punto 2), mismo criterio que ventas/consultas/calculos.ts. */

// A diferencia de calcularSubtotalItem() (que redondea a centavos, como
// el resto de /ventas), acá se redondea a peso entero — pedido de
// Jason (2026-09-11): el reparto proporcional de un combo entre sus
// productos cae naturalmente en centavos ($16.682,93), y en un
// minimarket donde todos los precios son en pesos redondos eso se ve
// raro. Ver el "último ítem se lleva el resto" más abajo: con esto la
// suma de las líneas de un combo sigue cerrando exacto contra
// precio_promocional, ítem por ítem redondeado.
function redondearAPeso(monto: number): number {
  return Math.round(monto);
}

/** Detecta qué promos activas encajan con el carrito y devuelve una
 *  copia de `items` con `subtotal`/`promoAplicada` puestos en las
 *  líneas afectadas — el resto de las líneas vuelve igual (misma
 *  referencia), sin tocarlas.
 *
 *  Reglas:
 *  - Una línea con `subtotal` ya tipeado a mano (venta por peso a
 *    monto exacto, ver FilaCarritoItem.tsx) nunca se toca: un producto
 *    fiambre/queso no es a lo que apunta este pedido, y pisar un monto
 *    que el cajero ya cargó explícito sería peor que no aplicar nada.
 *  - Los combos se resuelven primero (piden productos puntuales
 *    juntos, más específico) y consumen del mismo pool de unidades que
 *    después miran los descuentos por cantidad — un producto que ya
 *    entró en un combo no se cuenta dos veces.
 *  - El precio de un combo se reparte entre sus líneas proporcional al
 *    precio normal de cada una (no hay forma de insertar una línea de
 *    "descuento" suelta: ventas_items.producto_id no admite null) — ver
 *    PLAN-PROMOCIONES.md, sección 2, para la discusión de esta
 *    simplificación y su efecto en "ganancia por producto" en Reportes.
 */
export function aplicarPromociones(items: ItemCarrito[], promociones: Promocion[]): ItemCarritoConPromo[] {
  const elegibles = new Map<string, ItemCarrito>();
  for (const item of items) {
    if (item.subtotal === undefined) elegibles.set(item.productoId, item);
  }

  if (elegibles.size === 0) return items;

  const restante = new Map<string, number>();
  for (const item of elegibles.values()) restante.set(item.productoId, item.cantidad);

  const montoPromoPorProducto = new Map<string, number>();
  const ahorroPorProducto = new Map<string, number>();
  const nombrePorProducto = new Map<string, string>();

  function registrarPromo(productoId: string, monto: number, ahorro: number, nombre: string) {
    montoPromoPorProducto.set(productoId, (montoPromoPorProducto.get(productoId) ?? 0) + monto);
    ahorroPorProducto.set(productoId, (ahorroPorProducto.get(productoId) ?? 0) + ahorro);
    const anterior = nombrePorProducto.get(productoId);
    nombrePorProducto.set(productoId, anterior ? `${anterior} + ${nombre}` : nombre);
  }

  const activas = promociones.filter((promocion) => promocion.activa);

  for (const promocion of activas.filter((p) => p.tipo === "combo")) {
    if (promocion.items.length < 2) continue;
    if (!promocion.items.every((pi) => elegibles.has(pi.productoId))) continue;

    const veces = Math.min(
      ...promocion.items.map((pi) => Math.floor((restante.get(pi.productoId) ?? 0) / pi.cantidad)),
    );
    if (veces <= 0) continue;

    const normalPorInstancia = new Map<string, number>();
    let normalTotalPorInstancia = 0;
    for (const pi of promocion.items) {
      const item = elegibles.get(pi.productoId)!;
      const normal = item.precioUnitario * pi.cantidad;
      normalPorInstancia.set(pi.productoId, normal);
      normalTotalPorInstancia += normal;
    }
    if (normalTotalPorInstancia <= 0) continue;

    // Cada ítem redondea a peso entero, salvo el último: ese se lleva
    // lo que sobra del total exacto de la promo (no su propio
    // redondeo), para que la suma de las líneas cierre siempre exacto
    // contra precio_promocional × veces, sin importar cómo caigan los
    // redondeos de los demás.
    const montoTotalPromo = promocion.precioPromocional * veces;
    let montoAsignadoAcumulado = 0;

    promocion.items.forEach((pi, indice) => {
      const normal = normalPorInstancia.get(pi.productoId)!;
      const esUltimo = indice === promocion.items.length - 1;
      const montoAsignado = esUltimo
        ? redondearAPeso(montoTotalPromo - montoAsignadoAcumulado)
        : redondearAPeso((normal / normalTotalPorInstancia) * montoTotalPromo);
      montoAsignadoAcumulado += montoAsignado;

      const normalTotal = normal * veces;
      registrarPromo(pi.productoId, montoAsignado, normalTotal - montoAsignado, promocion.nombre);
      restante.set(pi.productoId, (restante.get(pi.productoId) ?? 0) - pi.cantidad * veces);
    });
  }

  for (const promocion of activas.filter((p) => p.tipo === "cantidad")) {
    if (promocion.items.length !== 1) continue;
    const pi = promocion.items[0];
    const item = elegibles.get(pi.productoId);
    if (!item) continue;

    const disponible = restante.get(pi.productoId) ?? 0;
    const paquetes = Math.floor(disponible / pi.cantidad);
    if (paquetes <= 0) continue;

    const cantidadUsada = pi.cantidad * paquetes;
    const montoAsignado = promocion.precioPromocional * paquetes;
    const normalDeEstaParte = item.precioUnitario * cantidadUsada;

    registrarPromo(pi.productoId, montoAsignado, normalDeEstaParte - montoAsignado, promocion.nombre);
    restante.set(pi.productoId, disponible - cantidadUsada);
  }

  if (montoPromoPorProducto.size === 0) return items;

  return items.map((item) => {
    const montoPromo = montoPromoPorProducto.get(item.productoId);
    if (montoPromo === undefined) return item;

    const cantidadSobrante = restante.get(item.productoId) ?? 0;
    const subtotalFinal = redondearAPeso(montoPromo + cantidadSobrante * item.precioUnitario);
    const ahorro = Math.max(0, redondearAPeso(ahorroPorProducto.get(item.productoId) ?? 0));

    const resultado: ItemCarritoConPromo = {
      ...item,
      subtotal: subtotalFinal,
      promoAplicada: { nombre: nombrePorProducto.get(item.productoId)!, ahorro },
    };
    return resultado;
  });
}
