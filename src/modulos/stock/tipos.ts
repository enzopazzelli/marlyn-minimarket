export type Categoria = {
  id: string;
  nombre: string;
};

// Misma forma que Categoria (id + nombre) — proveedores es una tabla
// plana igual que categorias, no una jerarquía.
export type Proveedor = Categoria;

export type Producto = {
  id: string;
  nombre: string;
  categoriaId: string | null;
  proveedorId: string | null;
  codigoBarras: string | null;
  precioCosto: number;
  precioVenta: number;
  // Cómo se llegó a precioVenta la última vez que se calculó en el
  // formulario — se guarda para que editar el producto más adelante no
  // arranque la calculadora en blanco (mismo criterio que
  // `porcentaje_ganancia` en miadmin/domain/models/producto.py).
  incluyeIva: boolean;
  porcentajeGanancia: number | null;
  stockActual: number;
  stockMinimo: number;
  unidad: "unidad" | "kg" | "litro";
  activo: boolean;
};
