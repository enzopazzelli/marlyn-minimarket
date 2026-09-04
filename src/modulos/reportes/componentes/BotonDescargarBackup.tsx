"use client";

import { useState } from "react";
import { Boton } from "@/componentes/Boton";
import { filaSegura } from "@/lib/excel";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { traerTodasLasFilas } from "@/lib/supabase/paginado";
import { etiquetaTurno, mapaIdNombre, resolverFilasLegibles, type MapasLegibles } from "../consultas/backupLegible";

// Backup manual bajo pedido (no automático, no reemplaza un backup real
// de la base): una hoja por tabla. A diferencia de los otros exports
// (Stock, Caja, cuenta corriente, Reportes del día) esto es un respaldo
// para archivar, no un reporte curado — pero desde 2026-08-19 sí se
// traduce una cosa: toda columna que sea FK a otra tabla (categoria_id,
// proveedor_id, cliente_id, usuario_id, venta_id, turno_id) se resuelve
// a nombre/etiqueta legible (`backupLegible.ts`), en vez de quedar como
// uuid crudo — el propio `id` de cada fila no se toca.
//
// Solo `categorias`, `proveedores`, `productos` y `clientes` son
// reimportables (`FormularioReimportarBackup.tsx`, botón al lado). Las
// tablas transaccionales/derivadas de abajo (ventas, pagos, movimientos
// de stock/caja/cuenta corriente, turnos) siguen siendo de un solo
// sentido — cada escritura ahí hoy pasa por una función `security
// definer` (`registrar_venta`/`anular_venta`/`registrar_ajuste_stock`/
// `registrar_movimiento_cuenta_corriente`) que mantiene consistentes
// stock, caja y cuenta corriente en un solo paso atómico; reconstruir
// esas 7 tablas desde un Excel editado a mano tiraría eso por la borda.
// `notas` tampoco se reimporta: no hay demanda real de bulk-edit ahí.
const TABLAS = [
  "categorias",
  "productos",
  "proveedores",
  "clientes",
  "turnos_caja",
  "movimientos_caja",
  "ventas",
  "ventas_items",
  "ventas_pagos",
  "movimientos_stock",
  "movimientos_cuenta_corriente",
  "notas",
  "auditoria_movimientos",
] as const;

// perfiles aparte, con columnas explícitas en vez de "*": así, si el
// día de mañana se le agrega una columna sensible, no se cuela sola en
// un archivo que se puede compartir — sin esto, usuario_id en el resto
// de las hojas es un uuid sin nombre. (token_pantalla, el link de
// emparejamiento de la TV, ya no vive acá — pasó a
// configuracion_comercio, una tabla aparte que ni siquiera está en
// TABLAS más abajo.)
const COLUMNAS_PERFILES = "id, nombre, rol, activo, creado_en";

export function BotonDescargarBackup() {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setError(null);
    setGenerando(true);
    try {
      const supabase = crearClienteNavegador();
      const { default: ExcelJS } = await import("exceljs");
      const libro = new ExcelJS.Workbook();

      // 1) Traer todas las tablas antes de armar ninguna hoja: los mapas
      // id → nombre necesitan los datos completos de categorias,
      // proveedores, productos, clientes y ventas, y esos mismos datos
      // son los que después se vuelcan a su propia hoja — una sola
      // consulta por tabla, no una aparte para el mapa y otra para el
      // export.
      const datosPorTabla: Record<string, Record<string, unknown>[]> = {};
      for (const tabla of TABLAS) {
        datosPorTabla[tabla] = await traerTodasLasFilas<Record<string, unknown>>(supabase, tabla, "*");
      }
      const perfiles = await traerTodasLasFilas<Record<string, unknown>>(supabase, "perfiles", COLUMNAS_PERFILES);

      // 2) Mapas de lookup id → texto legible.
      const perfilesPorId = mapaIdNombre(perfiles);
      const mapas: MapasLegibles = {
        categorias: mapaIdNombre(datosPorTabla.categorias),
        proveedores: mapaIdNombre(datosPorTabla.proveedores),
        productos: mapaIdNombre(datosPorTabla.productos),
        clientes: mapaIdNombre(datosPorTabla.clientes),
        perfiles: perfilesPorId,
        ventas: new Map(datosPorTabla.ventas.map((venta) => [String(venta.id), `Venta #${venta.numero}`])),
        turnos: new Map(
          datosPorTabla.turnos_caja.map((turno) => [
            String(turno.id),
            etiquetaTurno(perfilesPorId.get(String(turno.usuario_id)), turno.abierto_en),
          ]),
        ),
      };

      // 3) Una hoja por tabla, con las columnas FK ya resueltas.
      for (const tabla of TABLAS) {
        const filas = resolverFilasLegibles(tabla, datosPorTabla[tabla], mapas);
        const hoja = libro.addWorksheet(tabla);

        if (filas.length > 0) {
          hoja.columns = Object.keys(filas[0]).map((columna) => ({ header: columna, key: columna, width: 22 }));
          hoja.addRows(filas.map(filaSegura));
        }
      }

      const hojaPerfiles = libro.addWorksheet("perfiles");
      if (perfiles.length > 0) {
        hojaPerfiles.columns = Object.keys(perfiles[0]).map((columna) => ({
          header: columna,
          key: columna,
          width: 22,
        }));
        hojaPerfiles.addRows(perfiles.map(filaSegura));
      }

      const buffer = await libro.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo generar el backup. Probá de nuevo.");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Boton type="button" variante="fantasma" onClick={descargar} disabled={generando}>
        {generando ? "Generando backup…" : "Descargar backup completo"}
      </Boton>
      {error && <p className="text-xs text-alerta">{error}</p>}
    </div>
  );
}
