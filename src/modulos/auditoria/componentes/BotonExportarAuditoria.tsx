"use client";

import { useState } from "react";
import { Boton } from "@/componentes/Boton";
import { filaSegura } from "@/lib/excel";
import { formatearFechaHora } from "@/lib/formato";
import { INFO_TIPO_AUDITORIA } from "../tipos";
import type { MovimientoAuditoria } from "../tipos";

// Exporta exactamente lo que está en pantalla (los filtros de
// Usuario/Tipo ya aplicados, no todo el rango de fechas) — para el uso
// real de esto ("revisar los recargos de tal empleado en tal mes"),
// exportar lo mismo que se está mirando es más útil que todo el rango.
// filaSegura(): motivo/nota/nombre de producto o cliente viajan tal
// cual el usuario los escribió en "descripcion" — sin esto, un texto
// que arranca con "=" se interpreta como fórmula al abrir el Excel
// (regla 5 del prompt-base).
export function BotonExportarAuditoria({
  movimientos,
  nombrePorId,
}: {
  movimientos: MovimientoAuditoria[];
  nombrePorId: Map<string, string>;
}) {
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportar() {
    setError(null);
    setExportando(true);
    try {
      const { default: ExcelJS } = await import("exceljs");
      const libro = new ExcelJS.Workbook();
      const hoja = libro.addWorksheet("Auditoría");
      hoja.columns = [
        { header: "Fecha", key: "fecha", width: 18 },
        { header: "Usuario", key: "usuario", width: 20 },
        { header: "Tipo", key: "tipo", width: 24 },
        { header: "Detalle", key: "detalle", width: 44 },
        { header: "Monto", key: "monto", width: 14 },
      ];
      hoja.addRows(
        movimientos.map((movimiento) =>
          filaSegura({
            fecha: formatearFechaHora(movimiento.fecha),
            usuario: movimiento.usuarioId ? (nombrePorId.get(movimiento.usuarioId) ?? "—") : "—",
            tipo: INFO_TIPO_AUDITORIA[movimiento.tipo].etiqueta,
            detalle: movimiento.descripcion,
            monto: movimiento.monto,
          }),
        ),
      );

      const buffer = await libro.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `auditoria-${new Date().toISOString().slice(0, 10)}.xlsx`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo generar el Excel. Probá de nuevo.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Boton type="button" variante="fantasma" onClick={exportar} disabled={exportando || movimientos.length === 0}>
        {exportando ? "Exportando…" : "Exportar Excel"}
      </Boton>
      {error && <p className="text-xs text-alerta">{error}</p>}
    </div>
  );
}
