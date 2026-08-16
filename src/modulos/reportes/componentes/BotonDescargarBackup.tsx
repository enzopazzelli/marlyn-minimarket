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
// `filaSegura`, ver más abajo). `perfiles` queda afuera: son cuentas de
// operador, no datos del negocio, y tiene `token_pantalla` (sensible).
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
] as const;

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
