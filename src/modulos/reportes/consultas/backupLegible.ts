import { formatearFechaHora } from "@/lib/formato";

/** Función pura: sin Supabase ni exceljs, para poder testearla con
 *  Vitest sola (mismo criterio que importarExcel.ts). Arma las columnas
 *  legibles del backup completo (BotonDescargarBackup.tsx) — reemplaza
 *  cada columna que es FK a otra tabla (categoria_id, proveedor_id,
 *  cliente_id, usuario_id, venta_id, turno_id) por el nombre/etiqueta de
 *  lo que referencia, sin tocar el "id" propio de cada fila. */

export type MapasLegibles = {
  categorias: Map<string, string>;
  proveedores: Map<string, string>;
  productos: Map<string, string>;
  clientes: Map<string, string>;
  perfiles: Map<string, string>;
  ventas: Map<string, string>;
  turnos: Map<string, string>;
};

type ResolucionColumna = { columna: string; nuevoNombre: string; mapa: keyof MapasLegibles };

// No es la clave de importación (eso vive en reimportarMaestros.ts) —
// esto es solo para que se pueda leer. Una tabla que no aparece acá no
// tiene ninguna columna FK que resolver.
const RESOLUCIONES_POR_TABLA: Record<string, ResolucionColumna[]> = {
  productos: [
    { columna: "categoria_id", nuevoNombre: "categoria", mapa: "categorias" },
    { columna: "proveedor_id", nuevoNombre: "proveedor", mapa: "proveedores" },
  ],
  movimientos_cuenta_corriente: [
    { columna: "cliente_id", nuevoNombre: "cliente", mapa: "clientes" },
    { columna: "venta_id", nuevoNombre: "venta", mapa: "ventas" },
    { columna: "creado_por", nuevoNombre: "creado_por", mapa: "perfiles" },
  ],
  turnos_caja: [{ columna: "usuario_id", nuevoNombre: "usuario", mapa: "perfiles" }],
  movimientos_caja: [
    { columna: "turno_id", nuevoNombre: "turno", mapa: "turnos" },
    { columna: "usuario_id", nuevoNombre: "usuario", mapa: "perfiles" },
  ],
  ventas: [
    { columna: "turno_caja_id", nuevoNombre: "turno", mapa: "turnos" },
    { columna: "cliente_id", nuevoNombre: "cliente", mapa: "clientes" },
    { columna: "usuario_id", nuevoNombre: "usuario", mapa: "perfiles" },
    { columna: "anulada_por", nuevoNombre: "anulada_por", mapa: "perfiles" },
  ],
  ventas_items: [
    { columna: "venta_id", nuevoNombre: "venta", mapa: "ventas" },
    { columna: "producto_id", nuevoNombre: "producto", mapa: "productos" },
  ],
  ventas_pagos: [{ columna: "venta_id", nuevoNombre: "venta", mapa: "ventas" }],
  movimientos_stock: [
    { columna: "producto_id", nuevoNombre: "producto", mapa: "productos" },
    { columna: "venta_id", nuevoNombre: "venta", mapa: "ventas" },
    { columna: "usuario_id", nuevoNombre: "usuario", mapa: "perfiles" },
  ],
  notas: [{ columna: "creado_por", nuevoNombre: "creado_por", mapa: "perfiles" }],
  auditoria_movimientos: [{ columna: "usuario_id", nuevoNombre: "usuario", mapa: "perfiles" }],
};

// Un id que no aparece en su mapa (fila huérfana, o el mapa no la trae
// por algún motivo) no se deja en blanco silenciosamente — se avisa,
// mismo criterio de "fallar visible" que el resto del proyecto.
export const SIN_RESOLVER = "(no encontrado)";

export function mapaIdNombre(filas: Record<string, unknown>[]): Map<string, string> {
  return new Map(filas.map((fila) => [String(fila.id), String(fila.nombre)]));
}

export function etiquetaTurno(usuarioNombre: string | undefined, abiertoEn: unknown): string {
  const nombre = usuarioNombre ?? SIN_RESOLVER;
  const fecha = typeof abiertoEn === "string" || abiertoEn instanceof Date ? formatearFechaHora(abiertoEn) : "";
  return fecha ? `${nombre} — ${fecha}` : nombre;
}

export function resolverFilaLegible(
  tabla: string,
  fila: Record<string, unknown>,
  mapas: MapasLegibles,
): Record<string, unknown> {
  const resoluciones = RESOLUCIONES_POR_TABLA[tabla];
  if (!resoluciones || resoluciones.length === 0) return fila;

  const resultado: Record<string, unknown> = { ...fila };

  for (const { columna, nuevoNombre, mapa } of resoluciones) {
    const id = fila[columna];
    delete resultado[columna];
    resultado[nuevoNombre] = id === null || id === undefined ? null : (mapas[mapa].get(String(id)) ?? SIN_RESOLVER);
  }

  return resultado;
}

export function resolverFilasLegibles(
  tabla: string,
  filas: Record<string, unknown>[],
  mapas: MapasLegibles,
): Record<string, unknown>[] {
  return filas.map((fila) => resolverFilaLegible(tabla, fila, mapas));
}
