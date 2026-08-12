/** Función pura: sin Supabase ni navegador, para poder testearla con
 *  Vitest solo (prompt-base sección 7, punto 2). Replica en el front los
 *  mismos `check` de la migración de Stock; el `check` de la base sigue
 *  siendo la barrera real (regla de seguridad 4). */

export type DatosProducto = {
  nombre: string;
  precioCosto: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
};

export type ErroresProducto = Partial<Record<keyof DatosProducto, string>>;

export function validarProducto(datos: DatosProducto): {
  valido: boolean;
  errores: ErroresProducto;
} {
  const errores: ErroresProducto = {};

  if (!datos.nombre.trim()) {
    errores.nombre = "Escribí el nombre del producto";
  }

  if (!Number.isFinite(datos.precioVenta) || datos.precioVenta < 0) {
    errores.precioVenta = "El precio de venta tiene que ser mayor o igual a cero";
  }

  if (!Number.isFinite(datos.precioCosto) || datos.precioCosto < 0) {
    errores.precioCosto = "El precio de costo no puede ser negativo";
  }

  if (!Number.isFinite(datos.stockActual) || datos.stockActual < 0) {
    errores.stockActual = "El stock no puede ser negativo";
  }

  if (!Number.isFinite(datos.stockMinimo) || datos.stockMinimo < 0) {
    errores.stockMinimo = "El mínimo no puede ser negativo";
  }

  return { valido: Object.keys(errores).length === 0, errores };
}
