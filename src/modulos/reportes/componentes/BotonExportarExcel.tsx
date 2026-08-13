"use client";

import { useState } from "react";
import { Boton } from "@/componentes/Boton";
import type { ResumenDia } from "../tipos";

// exceljs se importa dinámicamente, solo al hacer click: es una
// dependencia pesada y este botón puede no usarse nunca en una visita.
export function BotonExportarExcel({ fecha, resumen }: { fecha: string; resumen: ResumenDia }) {
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportar() {
    setError(null);
    setExportando(true);
    try {
      const { default: ExcelJS } = await import("exceljs");
      const libro = new ExcelJS.Workbook();

      const hojaResumen = libro.addWorksheet("Resumen");
      hojaResumen.columns = [
        { header: "Indicador", key: "indicador", width: 28 },
        { header: "Valor", key: "valor", width: 18 },
      ];
      hojaResumen.addRow({ indicador: "Ventas", valor: resumen.totalVentas });
      hojaResumen.addRow({ indicador: "Ticket promedio", valor: resumen.ticketPromedio });
      hojaResumen.addRow({ indicador: "Transacciones", valor: resumen.cantidadTransacciones });
      hojaResumen.addRow({ indicador: "Balance (margen bruto)", valor: resumen.margenBruto });

      const hojaMedios = libro.addWorksheet("Medios de pago");
      hojaMedios.columns = [
        { header: "Medio", key: "medio", width: 20 },
        { header: "Monto", key: "monto", width: 16, style: { numFmt: '"$"#,##0.00' } },
        { header: "%", key: "porcentaje", width: 8 },
      ];
      hojaMedios.addRows(resumen.distribucionMedioPago);

      const hojaProductos = libro.addWorksheet("Top productos");
      hojaProductos.columns = [
        { header: "Producto", key: "nombre", width: 32 },
        { header: "Cantidad", key: "cantidad", width: 12 },
        { header: "Subtotal", key: "subtotal", width: 16, style: { numFmt: '"$"#,##0.00' } },
      ];
      hojaProductos.addRows(resumen.topProductos);

      const buffer = await libro.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `reporte-${fecha}.xlsx`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo generar el Excel. Probá de nuevo.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Boton type="button" variante="fantasma" onClick={exportar} disabled={exportando}>
        {exportando ? "Exportando…" : "Exportar a Excel"}
      </Boton>
      {error && <p className="text-xs text-alerta">{error}</p>}
    </div>
  );
}
