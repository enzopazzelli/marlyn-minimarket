export type Categoria = {
  id: string;
  nombre: string;
};

// La definición canónica de Proveedor vive en el módulo proveedores
// (tiene su propia pantalla desde /proveedores); se reexporta acá para
// no tener que tocar los imports de los formularios de producto, que
// ya lo traían de "../tipos".
export type { Proveedor } from "@/modulos/proveedores/tipos";

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
