"use client";

import { useState } from "react";
import { Boton } from "@/componentes/Boton";
import { filaSegura } from "@/lib/excel";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { traerTodasLasFilas } from "@/lib/supabase/paginado";

// Backup manual bajo pedido (no automático, no reemplaza un backup real
// de la base): una hoja por tabla, con las columnas tal cual están
// guardadas — a diferencia de los otros exports (Stock, Caja, cuenta
// corriente, Reportes del día), esto es un respaldo para archivar, no
// un reporte para leer, así que no se cura ni se traduce nada (salvo
// `filaSegura`, ver más abajo). auditoria_movimientos entra igual que
// cualquier tabla (es una vista, PostgREST no distingue) — junta lo de
// las cinco tablas de abajo ya legible, así que queda como hoja de
// consulta rápida sin tener que cruzar usuario_id a mano.
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

// perfiles aparte, con columnas explícitas en vez de "*": tiene
// token_pantalla (el link de emparejamiento de la TV del mostrador,
// sensible — cualquiera con ese link puede mirar la venta en curso) que
// no tiene por qué viajar en un archivo que se puede compartir. Sin
// esto, usuario_id en el resto de las hojas es un uuid sin nombre.
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

      for (const tabla of TABLAS) {
        const filas = await traerTodasLasFilas<Record<string, unknown>>(supabase, tabla, "*");
        const hoja = libro.addWorksheet(tabla);

        if (filas.length > 0) {
          hoja.columns = Object.keys(filas[0]).map((columna) => ({ header: columna, key: columna, width: 22 }));
          hoja.addRows(filas.map(filaSegura));
        }
      }

      const perfiles = await traerTodasLasFilas<Record<string, unknown>>(supabase, "perfiles", COLUMNAS_PERFILES);
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
