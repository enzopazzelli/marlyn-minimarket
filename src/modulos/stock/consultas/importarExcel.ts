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
  /** Los dos últimos solo los trae el formato "plantilla" (ver abajo);
   *  el del sistema viejo no tiene esas columnas y usa los defaults de
   *  la tabla productos. */
  unidad: "unidad" | "kg" | "litro";
  stockMinimo: number;
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

// Palabras que NO se capitalizan cuando van en el medio del nombre. Sin
// esto, "Golosinas y Chocolates" quedaba "Golosinas Y Chocolates" y
// "Bebidas sin Alcohol" quedaba "Bebidas Sin Alcohol" — 11 de los 24
// rubros del catálogo real salían así, y es lo primero que se ve en la
// pantalla de Stock.
const CONECTORES = new Set([
  "y", "e", "o", "u", "de", "del", "la", "las", "los", "el",
  "con", "sin", "para", "a", "al", "en",
]);

// Trim + espacios colapsados + Title Case, para que "VARIOS"/"Varios"/
// "varios " terminen siendo un solo rubro (o proveedor) en vez de tres.
export function normalizarNombre(valor: string): string {
  return valor
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((palabra, indice) =>
      indice > 0 && CONECTORES.has(palabra)
        ? palabra
        : palabra.charAt(0).toUpperCase() + palabra.slice(1),
    )
    .join(" ");
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
      // El export del sistema viejo no trae ninguna de las dos: quedan
      // en el default de la tabla, igual que antes de que existieran
      // estas claves.
      unidad: "unidad",
      stockMinimo: 0,
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

// ============================================================
// Formato "plantilla del sistema"
//
// El import de más arriba espera el export del sistema VIEJO del
// cliente: Descripcion/Proveedor/Codigo de barra/Familia/Costo, sin
// precio de venta — por eso pide un % de margen y lo calcula.
//
// Este segundo formato es la plantilla que exporta esta misma app
// (Código de barras/Producto/Rubro/Proveedor/Precio costo/Precio
// venta/Stock actual/Stock mínimo/Unidad): ya trae el precio de venta
// real, así que no hay margen que aplicar. Se detecta solo por los
// encabezados, el usuario no elige nada.
// ============================================================

export type UnidadProducto = "unidad" | "kg" | "litro";

/** Encabezado comparable: sin mayúsculas, sin acentos y sin espacios de
 *  más, para que "Código de barras" y "codigo de barras" sean lo mismo. */
export function normalizarEncabezado(valor: unknown): string {
  return String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const COLUMNAS_CATALOGO = ["descripcion", "proveedor", "codigo de barra", "familia", "costo"];
export const COLUMNAS_PLANTILLA = [
  "codigo de barras",
  "producto",
  "rubro",
  "proveedor",
  "precio costo",
  "precio venta",
  "unidad",
];

/** Elige el formato al que más se parece el archivo y devuelve qué
 *  columnas le faltan para ese formato — así el error dice exactamente
 *  qué agregar, en vez de un "no tiene las columnas esperadas". */
export function detectarFormato(encabezados: unknown[]): {
  formato: "plantilla" | "catalogo";
  faltantes: string[];
} {
  const presentes = new Set(encabezados.map(normalizarEncabezado).filter(Boolean));
  const faltanPlantilla = COLUMNAS_PLANTILLA.filter((columna) => !presentes.has(columna));
  const faltanCatalogo = COLUMNAS_CATALOGO.filter((columna) => !presentes.has(columna));

  return faltanPlantilla.length <= faltanCatalogo.length
    ? { formato: "plantilla", faltantes: faltanPlantilla }
    : { formato: "catalogo", faltantes: faltanCatalogo };
}

/** null = la celda no es un número usable. Vacío también da null: el
 *  llamador decide si eso es "queda en cero" o "fila rechazada".
 *  Tolera "$", separador de miles y coma decimal, porque el cliente
 *  arma el Excel a mano y formatea las celdas como moneda. */
export function aNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  // exceljs devuelve un objeto para las celdas con fórmula
  if (typeof valor === "object" && "result" in (valor as Record<string, unknown>)) {
    return aNumero((valor as { result: unknown }).result);
  }

  const texto = String(valor).trim().replace(/\$/g, "").replace(/\s/g, "");
  if (texto === "") return null;
  // "1.234,56" (es-AR) vs "1234.56"
  const normalizado = texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

/** null = unidad no reconocida (la fila se rechaza). Vacío cae en
 *  "unidad", que es el default de la columna en la base. */
export function normalizarUnidad(valor: unknown): UnidadProducto | null {
  const texto = normalizarEncabezado(valor);
  if (texto === "") return "unidad";
  if (["unidad", "unidades", "u", "un", "uni"].includes(texto)) return "unidad";
  if (["kg", "kilo", "kilos", "kilogramo", "kilogramos"].includes(texto)) return "kg";
  if (["litro", "litros", "l", "lt", "lts"].includes(texto)) return "litro";
  return null;
}

export type FilaExcelPlantilla = {
  numeroFila: number;
  producto: string;
  rubro: string;
  proveedor: string;
  codigoBarra: string | number | null | undefined;
  precioCosto: unknown;
  precioVenta: unknown;
  stockActual: unknown;
  stockMinimo: unknown;
  unidad: unknown;
};

export type FilaRechazada = { numeroFila: number; producto: string; motivo: string };

export type ResumenImportacionPlantilla = {
  totalFilas: number;
  aImportar: number;
  salteadasPorCodigoExistente: number;
  sinCodigoBarras: number;
  sinRubro: number;
  sinProveedor: number;
  /** Filas con "Stock actual" mayor a cero. No se importa: el stock
   *  solo se mueve con registrar_ingreso_stock(), para que siempre
   *  quede su fila en movimientos_stock. Se cuenta para poder avisarlo. */
  conStockEnElArchivo: number;
  categoriasNuevas: string[];
  proveedoresNuevos: string[];
  productos: ProductoAImportar[];
  rechazadas: FilaRechazada[];
};

export function construirImportacionDesdePlantilla(
  filas: FilaExcelPlantilla[],
  existentes: { categorias: string[]; proveedores: string[]; codigosBarras: string[] },
): ResumenImportacionPlantilla {
  const categoriasExistentes = new Set(existentes.categorias.map((nombre) => nombre.toLowerCase()));
  const proveedoresExistentes = new Set(existentes.proveedores.map((nombre) => nombre.toLowerCase()));
  const codigosExistentes = new Set(existentes.codigosBarras);
  const codigosUsadosEnElArchivo = new Set<string>();
  const categoriasNuevas = new Set<string>();
  const proveedoresNuevos = new Set<string>();
  const rechazadas: FilaRechazada[] = [];

  let salteadasPorCodigoExistente = 0;
  let sinCodigoBarras = 0;
  let sinRubro = 0;
  let sinProveedor = 0;
  let conStockEnElArchivo = 0;
  const productos: ProductoAImportar[] = [];

  const vacia = (valor: unknown) => valor === null || valor === undefined || String(valor).trim() === "";

  for (const fila of filas) {
    const nombre = fila.producto.trim();
    if (!nombre) continue;

    // Los tipos se validan primero: una celda con texto donde va un
    // número es el error que más veces volvió del cliente, y tiene que
    // salir con nombre y número de fila en vez de reventar entero
    // recién al confirmar.
    const precioVenta = aNumero(fila.precioVenta);
    if (precioVenta === null && !vacia(fila.precioVenta)) {
      rechazadas.push({ numeroFila: fila.numeroFila, producto: nombre, motivo: "Precio venta no es un número" });
      continue;
    }
    const precioCosto = aNumero(fila.precioCosto);
    if (precioCosto === null && !vacia(fila.precioCosto)) {
      rechazadas.push({ numeroFila: fila.numeroFila, producto: nombre, motivo: "Precio costo no es un número" });
      continue;
    }
    const stockMinimo = aNumero(fila.stockMinimo);
    if (stockMinimo === null && !vacia(fila.stockMinimo)) {
      rechazadas.push({ numeroFila: fila.numeroFila, producto: nombre, motivo: "Stock mínimo no es un número" });
      continue;
    }
    const unidad = normalizarUnidad(fila.unidad);
    if (unidad === null) {
      rechazadas.push({
        numeroFila: fila.numeroFila,
        producto: nombre,
        motivo: `Unidad "${String(fila.unidad)}" no es unidad, kg ni litro`,
      });
      continue;
    }

    let codigoBarras: string | null = esCodigoBarrasPlaceholder(fila.codigoBarra)
      ? null
      : String(fila.codigoBarra).trim();

    if (codigoBarras) {
      if (codigosExistentes.has(codigoBarras)) {
        salteadasPorCodigoExistente++;
        continue;
      }
      if (codigosUsadosEnElArchivo.has(codigoBarras)) {
        codigoBarras = null;
      } else {
        codigosUsadosEnElArchivo.add(codigoBarras);
      }
    }
    if (!codigoBarras) sinCodigoBarras++;

    if ((aNumero(fila.stockActual) ?? 0) > 0) conStockEnElArchivo++;

    // Vacío queda vacío: sin rubro y sin proveedor son estados válidos
    // (las dos FK son nullable). No se inventa un "Sin rubro".
    const categoriaNombre = fila.rubro.trim() ? normalizarNombre(fila.rubro) : "";
    const proveedorNombre = fila.proveedor.trim() ? normalizarNombre(fila.proveedor) : "";
    if (!categoriaNombre) sinRubro++;
    if (!proveedorNombre) sinProveedor++;

    if (categoriaNombre && !categoriasExistentes.has(categoriaNombre.toLowerCase())) {
      categoriasNuevas.add(categoriaNombre);
    }
    if (proveedorNombre && !proveedoresExistentes.has(proveedorNombre.toLowerCase())) {
      proveedoresNuevos.add(proveedorNombre);
    }

    productos.push({
      nombre,
      categoriaNombre,
      proveedorNombre,
      codigoBarras,
      precioCosto: precioCosto ?? 0,
      precioVenta: precioVenta ?? 0,
      unidad,
      stockMinimo: stockMinimo ?? 0,
    });
  }

  return {
    totalFilas: filas.length,
    aImportar: productos.length,
    salteadasPorCodigoExistente,
    sinCodigoBarras,
    sinRubro,
    sinProveedor,
    conStockEnElArchivo,
    categoriasNuevas: [...categoriasNuevas],
    proveedoresNuevos: [...proveedoresNuevos],
    productos,
    rechazadas,
  };
}
