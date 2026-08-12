export type Categoria = {
  id: string;
  nombre: string;
};

export type Producto = {
  id: string;
  nombre: string;
  categoriaId: string | null;
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
