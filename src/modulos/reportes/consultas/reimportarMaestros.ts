import { normalizarNombre } from "@/modulos/stock/consultas/importarExcel";

/** Función pura: sin Supabase ni exceljs, para poder testearla con
 *  Vitest sola (mismo criterio que importarExcel.ts). A diferencia de
 *  construirImportacion() (que solo da de alta), esto arma un diff de
 *  alta + edición para los 4 datos maestros del backup legible
 *  (categorias, proveedores, productos, clientes) — nunca borra: una
 *  fila que falta en la hoja simplemente no se toca. */

export type FilaExcelCategoria = { id: string | null; nombre: string };

export type FilaExcelProveedor = {
  id: string | null;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
};

export type FilaExcelProducto = {
  id: string | null;
  nombre: string;
  categoriaNombre: string;
  proveedorNombre: string | null;
  codigoBarras: string | null;
  precioCosto: number;
  precioVenta: number;
  unidad: "unidad" | "kg" | "litro";
  stockMinimo: number;
  activo: boolean;
};

export type FilaExcelCliente = { id: string | null; nombre: string; telefono: string | null; direccion: string | null };

export type HojasReimportacion = {
  categorias: FilaExcelCategoria[];
  proveedores: FilaExcelProveedor[];
  productos: FilaExcelProducto[];
  clientes: FilaExcelCliente[];
};

export type ExistentesReimportacion = {
  categoriasPorId: Set<string>;
  proveedoresPorId: Set<string>;
  productosPorId: Set<string>;
  clientesPorId: Set<string>;
  // nombres ya normalizados a minúscula.
  categoriasPorNombre: Set<string>;
  proveedoresPorNombre: Set<string>;
};

export type ErrorFila = { hoja: string; fila: number; motivo: string };

export type CategoriaReimportar = { id: string; nombre: string };
export type ProveedorReimportar = { id: string; nombre: string; contacto: string | null; telefono: string | null };
export type ProductoReimportar = {
  id: string | null; // null = alta
  nombre: string;
  categoriaNombre: string;
  proveedorNombre: string | null;
  codigoBarras: string | null;
  precioCosto: number;
  precioVenta: number;
  unidad: "unidad" | "kg" | "litro";
  stockMinimo: number;
  activo: boolean;
};
export type ClienteReimportar = { id: string | null; nombre: string; telefono: string | null; direccion: string | null };

export type ResumenReimportacion = {
  categoriasNuevas: string[];
  categoriasActualizar: CategoriaReimportar[];
  proveedoresNuevos: string[];
  proveedoresActualizar: ProveedorReimportar[];
  productos: ProductoReimportar[];
  clientes: ClienteReimportar[];
  errores: ErrorFila[];
};

export function construirReimportacionMaestros(
  hojas: HojasReimportacion,
  existentes: ExistentesReimportacion,
): ResumenReimportacion {
  const errores: ErrorFila[] = [];

  const categoriasNuevas = new Set<string>();
  const categoriasConocidas = new Set(existentes.categoriasPorNombre);
  const categoriasActualizar: CategoriaReimportar[] = [];

  hojas.categorias.forEach((fila, indice) => {
    const nombre = normalizarNombre(fila.nombre || "");
    if (!nombre) {
      errores.push({ hoja: "categorias", fila: indice + 2, motivo: "Nombre vacío" });
      return;
    }
    if (fila.id) {
      if (!existentes.categoriasPorId.has(fila.id)) {
        errores.push({ hoja: "categorias", fila: indice + 2, motivo: `El id "${fila.id}" no existe` });
        return;
      }
      categoriasActualizar.push({ id: fila.id, nombre });
    } else if (!categoriasConocidas.has(nombre.toLowerCase())) {
      categoriasNuevas.add(nombre);
      categoriasConocidas.add(nombre.toLowerCase());
    }
  });

  const proveedoresNuevos = new Set<string>();
  const proveedoresConocidos = new Set(existentes.proveedoresPorNombre);
  const proveedoresActualizar: ProveedorReimportar[] = [];

  hojas.proveedores.forEach((fila, indice) => {
    const nombre = normalizarNombre(fila.nombre || "");
    if (!nombre) {
      errores.push({ hoja: "proveedores", fila: indice + 2, motivo: "Nombre vacío" });
      return;
    }
    if (fila.id) {
      if (!existentes.proveedoresPorId.has(fila.id)) {
        errores.push({ hoja: "proveedores", fila: indice + 2, motivo: `El id "${fila.id}" no existe` });
        return;
      }
      proveedoresActualizar.push({
        id: fila.id,
        nombre,
        contacto: fila.contacto || null,
        telefono: fila.telefono || null,
      });
    } else if (!proveedoresConocidos.has(nombre.toLowerCase())) {
      proveedoresNuevos.add(nombre);
      proveedoresConocidos.add(nombre.toLowerCase());
    }
  });

  const productos: ProductoReimportar[] = [];
  hojas.productos.forEach((fila, indice) => {
    const nombre = (fila.nombre || "").trim();
    if (!nombre) {
      errores.push({ hoja: "productos", fila: indice + 2, motivo: "Nombre vacío" });
      return;
    }
    if (fila.id && !existentes.productosPorId.has(fila.id)) {
      errores.push({ hoja: "productos", fila: indice + 2, motivo: `El id "${fila.id}" no existe` });
      return;
    }

    const categoriaNombre = normalizarNombre(fila.categoriaNombre || "Sin rubro");
    const proveedorNombre = fila.proveedorNombre ? normalizarNombre(fila.proveedorNombre) : null;

    if (!categoriasConocidas.has(categoriaNombre.toLowerCase())) {
      categoriasNuevas.add(categoriaNombre);
      categoriasConocidas.add(categoriaNombre.toLowerCase());
    }
    if (proveedorNombre && !proveedoresConocidos.has(proveedorNombre.toLowerCase())) {
      proveedoresNuevos.add(proveedorNombre);
      proveedoresConocidos.add(proveedorNombre.toLowerCase());
    }

    productos.push({
      id: fila.id || null,
      nombre,
      categoriaNombre,
      proveedorNombre,
      codigoBarras: fila.codigoBarras || null,
      precioCosto: fila.precioCosto,
      precioVenta: fila.precioVenta,
      unidad: fila.unidad,
      stockMinimo: fila.stockMinimo,
      activo: fila.activo,
    });
  });

  const clientes: ClienteReimportar[] = [];
  hojas.clientes.forEach((fila, indice) => {
    const nombre = (fila.nombre || "").trim();
    if (!nombre) {
      errores.push({ hoja: "clientes", fila: indice + 2, motivo: "Nombre vacío" });
      return;
    }
    if (fila.id && !existentes.clientesPorId.has(fila.id)) {
      errores.push({ hoja: "clientes", fila: indice + 2, motivo: `El id "${fila.id}" no existe` });
      return;
    }
    clientes.push({ id: fila.id || null, nombre, telefono: fila.telefono || null, direccion: fila.direccion || null });
  });

  return {
    categoriasNuevas: [...categoriasNuevas],
    categoriasActualizar,
    proveedoresNuevos: [...proveedoresNuevos],
    proveedoresActualizar,
    productos,
    clientes,
    errores,
  };
}
