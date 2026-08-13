import { calcularPrecioVentaDesdeGanancia } from "./precios";

/** Funciones puras: sin Supabase ni navegador, para poder testearlas
 *  con Vitest solo (mismo criterio que precios.ts/calculos.ts). Parsear
 *  el archivo en sí (exceljs, File del navegador) vive en el componente. */

export type FilaExcelCatalogo = {
  descripcion: string;
  proveedor: string;
  codigoBarra: string | number | null | undefined;
  familia: string;
  costo: number;
};

export type ProductoAImportar = {
  nombre: string;
  categoriaNombre: string;
  proveedorNombre: string;
  codigoBarras: string | null;
  precioCosto: number;
  precioVenta: number;
};

export type ResumenImportacion = {
  totalFilas: number;
  aImportar: number;
  salteadasPorCodigoExistente: number;
  sinCodigoBarras: number;
  categoriasNuevas: string[];
  proveedoresNuevos: string[];
  productos: ProductoAImportar[];
};

// Placeholder del sistema viejo: vacío, o un mismo dígito repetido
// ("0", "11111111", "4444444444", etc.) — no colisiones reales.
export function esCodigoBarrasPlaceholder(valor: string | number | null | undefined): boolean {
  const texto = valor === null || valor === undefined ? "" : String(valor).trim();
  return texto === "" || /^(\d)\1*$/.test(texto);
}

// Trim + espacios colapsados + Title Case, para que "VARIOS"/"Varios"/
// "varios " terminen siendo un solo rubro (o proveedor) en vez de tres.
export function normalizarNombre(valor: string): string {
  return valor
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letra) => letra.toUpperCase());
}

export function construirImportacion(
  filas: FilaExcelCatalogo[],
  existentes: { categorias: string[]; proveedores: string[]; codigosBarras: string[] },
  opciones: { porcentajeGanancia: number; incluyeIva: boolean; ivaPorcentaje: number },
): ResumenImportacion {
  const categoriasExistentes = new Set(existentes.categorias.map((nombre) => nombre.toLowerCase()));
  const proveedoresExistentes = new Set(existentes.proveedores.map((nombre) => nombre.toLowerCase()));
  const codigosExistentes = new Set(existentes.codigosBarras);
  const codigosUsadosEnElArchivo = new Set<string>();
  const categoriasNuevas = new Set<string>();
  const proveedoresNuevos = new Set<string>();

  let salteadasPorCodigoExistente = 0;
  let sinCodigoBarras = 0;
  const productos: ProductoAImportar[] = [];

  for (const fila of filas) {
    let codigoBarras: string | null = esCodigoBarrasPlaceholder(fila.codigoBarra)
      ? null
      : String(fila.codigoBarra).trim();

    if (codigoBarras) {
      if (codigosExistentes.has(codigoBarras)) {
        salteadasPorCodigoExistente++;
        continue;
      }
      if (codigosUsadosEnElArchivo.has(codigoBarras)) {
        // Dos filas del mismo archivo con el mismo código real: la
        // primera se queda con el código, esta entra sin él (no puede
        // haber dos en el mismo insert masivo).
        codigoBarras = null;
      } else {
        codigosUsadosEnElArchivo.add(codigoBarras);
      }
    }

    if (!codigoBarras) sinCodigoBarras++;

    const categoriaNombre = normalizarNombre(fila.familia || "Sin rubro");
    const proveedorNombre = normalizarNombre(fila.proveedor);

    if (!categoriasExistentes.has(categoriaNombre.toLowerCase())) categoriasNuevas.add(categoriaNombre);
    if (!proveedoresExistentes.has(proveedorNombre.toLowerCase())) proveedoresNuevos.add(proveedorNombre);

    productos.push({
      nombre: fila.descripcion.trim(),
      categoriaNombre,
      proveedorNombre,
      codigoBarras,
      precioCosto: fila.costo,
      precioVenta: calcularPrecioVentaDesdeGanancia(
        fila.costo,
        opciones.porcentajeGanancia,
        opciones.incluyeIva,
        opciones.ivaPorcentaje,
      ),
    });
  }

  return {
    totalFilas: filas.length,
    aImportar: productos.length,
    salteadasPorCodigoExistente,
    sinCodigoBarras,
    categoriasNuevas: [...categoriasNuevas],
    proveedoresNuevos: [...proveedoresNuevos],
    productos,
  };
}
