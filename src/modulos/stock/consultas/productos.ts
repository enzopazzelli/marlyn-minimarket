import type { SupabaseClient } from "@supabase/supabase-js";
import type { Categoria, Producto } from "../tipos";

type FilaProducto = {
  id: string;
  nombre: string;
  categoria_id: string | null;
  proveedor_id: string | null;
  codigo_barras: string | null;
  precio_costo: number | string;
  precio_venta: number | string;
  incluye_iva: boolean;
  porcentaje_ganancia: number | string | null;
  stock_actual: number | string;
  stock_minimo: number | string;
  unidad: Producto["unidad"];
  activo: boolean;
};

// Recibe cualquier cliente de Supabase (servidor o navegador): el server
// component la usa para la carga inicial, el formulario de alta la
// reusaría para un refresco optimista si hiciera falta más adelante.
export async function listarProductos(supabase: SupabaseClient): Promise<Producto[]> {
  const { data, error } = await supabase
    .from("productos")
    .select(
      "id, nombre, categoria_id, proveedor_id, codigo_barras, precio_costo, precio_venta, incluye_iva, porcentaje_ganancia, stock_actual, stock_minimo, unidad, activo",
    )
    .order("creado_en", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as FilaProducto[]).map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    categoriaId: fila.categoria_id,
    proveedorId: fila.proveedor_id,
    codigoBarras: fila.codigo_barras,
    precioCosto: Number(fila.precio_costo),
    precioVenta: Number(fila.precio_venta),
    incluyeIva: fila.incluye_iva,
    porcentajeGanancia: fila.porcentaje_ganancia === null ? null : Number(fila.porcentaje_ganancia),
    stockActual: Number(fila.stock_actual),
    stockMinimo: Number(fila.stock_minimo),
    unidad: fila.unidad,
    activo: fila.activo,
  }));
}

export async function listarCategorias(supabase: SupabaseClient): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from("categorias")
    .select("id, nombre")
    .order("nombre", { ascending: true });

  if (error) throw error;

  return (data ?? []) as Categoria[];
}
