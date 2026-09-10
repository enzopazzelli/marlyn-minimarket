import type { SupabaseClient } from "@supabase/supabase-js";
import type { PromocionItem, TipoPromocion } from "../tipos";

export type ItemPromocionAdmin = PromocionItem & {
  nombreProducto: string;
  precioVenta: number;
  productoActivo: boolean;
};

export type PromocionAdmin = {
  id: string;
  nombre: string;
  tipo: TipoPromocion;
  precioPromocional: number;
  activa: boolean;
  items: ItemPromocionAdmin[];
  // Alguno de los productos de la promo quedó soft-deleted (activo =
  // false) desde /stock — la promo nunca va a poder dispararse (ese
  // producto ya no puede entrar al carrito de /ventas), pero se deja
  // visible con este aviso en vez de desactivarla sola: así Jason ve
  // qué pasó en vez de que la promo desaparezca sin explicación.
  necesitaRevision: boolean;
};

type FilaPromocion = {
  id: string;
  nombre: string;
  tipo: TipoPromocion;
  precio_promocional: number | string;
  activa: boolean;
  promociones_items: {
    producto_id: string;
    cantidad: number | string;
    productos: { nombre: string; precio_venta: number | string; activo: boolean } | null;
  }[];
};

// precio_venta acá nunca es sensible (a diferencia de precio_costo): es
// el mismo valor que ya ve cualquier perfil activo en el carrito de
// /ventas, así que se lee de "productos" directo — no hace falta pasar
// por la vista productos_visibles (esa existe para ocultarle el costo
// al operador, no aplica a esta consulta).
export async function listarPromociones(supabase: SupabaseClient): Promise<PromocionAdmin[]> {
  const { data, error } = await supabase
    .from("promociones")
    .select(
      "id, nombre, tipo, precio_promocional, activa, creado_en, " +
        "promociones_items(producto_id, cantidad, productos(nombre, precio_venta, activo))",
    )
    .order("creado_en", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as FilaPromocion[]).map((fila) => {
    const items: ItemPromocionAdmin[] = fila.promociones_items.map((pi) => ({
      productoId: pi.producto_id,
      cantidad: Number(pi.cantidad),
      nombreProducto: pi.productos?.nombre ?? "(producto eliminado)",
      precioVenta: pi.productos ? Number(pi.productos.precio_venta) : 0,
      productoActivo: pi.productos?.activo ?? false,
    }));

    return {
      id: fila.id,
      nombre: fila.nombre,
      tipo: fila.tipo,
      precioPromocional: Number(fila.precio_promocional),
      activa: fila.activa,
      items,
      necesitaRevision: items.some((item) => !item.productoActivo),
    };
  });
}

/** Lo que necesita aplicarPromociones() en /ventas: solo promos
 *  realmente utilizables (activas y sin ningún producto eliminado). */
export function paraAplicarEnVenta(promociones: PromocionAdmin[]) {
  return promociones
    .filter((promocion) => promocion.activa && !promocion.necesitaRevision)
    .map((promocion) => ({
      id: promocion.id,
      nombre: promocion.nombre,
      tipo: promocion.tipo,
      precioPromocional: promocion.precioPromocional,
      activa: promocion.activa,
      items: promocion.items.map((item) => ({ productoId: item.productoId, cantidad: item.cantidad })),
    }));
}
