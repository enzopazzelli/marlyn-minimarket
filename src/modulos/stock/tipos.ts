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
  stockActual: number;
  stockMinimo: number;
  unidad: "unidad" | "kg" | "litro";
  activo: boolean;
};
