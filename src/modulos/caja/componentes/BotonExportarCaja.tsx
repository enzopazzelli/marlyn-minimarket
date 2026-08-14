"use client";

import { useState } from "react";
import { Boton } from "@/componentes/Boton";
import type { VentaResumen } from "@/modulos/ventas/consultas/ventas";
import type { MovimientoCaja, TurnoCaja } from "../tipos";

const fechaFormateador = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
const horaFormateador = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

// exceljs se importa dinámicamente, solo al hacer click — mismo
// criterio que BotonExportarExcel.tsx (Reportes) y BotonExportarStock.tsx.
// Exporta lo mismo que ya se ve en la pantalla, a nivel turno (no día
// como Reportes — un turno puede cruzar la medianoche, y un día puede
// tener más de un turno).
export function BotonExportarCaja({
  turno,
  montoCalculado,
  ventas,
  movimientos,
}: {
  turno: TurnoCaja;
  montoCalculado: number;
  ventas: VentaResumen[];
  movimientos: MovimientoCaja[];
}) {
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
        { header: "Valor", key: "valor", width: 22 },
      ];
      hojaResumen.addRow({ indicador: "Apertura", valor: turno.montoApertura });
      hojaResumen.addRow({ indicador: "Debería haber", valor: montoCalculado });
      hojaResumen.addRow({
        indicador: "Desde",
        valor: `${fechaFormateador.format(new Date(turno.abiertoEn))} ${horaFormateador.format(new Date(turno.abiertoEn))}`,
      });
      hojaResumen.addRow({ indicador: "Transacciones", valor: ventas.length });

      const hojaVentas = libro.addWorksheet("Ventas del turno");
      hojaVentas.columns = [
        { header: "Venta", key: "numero", width: 8 },
        { header: "Hora", key: "hora", width: 10 },
        { header: "Cliente", key: "cliente", width: 20 },
        { header: "Medio", key: "medio", width: 20 },
        { header: "Total", key: "total", width: 14, style: { numFmt: '"$"#,##0.00' } },
      ];
      hojaVentas.addRows(
        ventas.map((venta) => ({
          numero: venta.numero,
          hora: horaFormateador.format(new Date(venta.creadoEn)),
          cliente: venta.clienteNombre ?? "",
          medio: venta.medioTexto,
          total: venta.total,
        })),
      );

      const hojaMovimientos = libro.addWorksheet("Movimientos de caja");
      hojaMovimientos.columns = [
        { header: "Hora", key: "hora", width: 10 },
        { header: "Motivo", key: "motivo", width: 32 },
        { header: "Tipo", key: "tipo", width: 12 },
        { header: "Monto", key: "monto", width: 14, style: { numFmt: '"$"#,##0.00' } },
      ];
      hojaMovimientos.addRows(
        movimientos.map((movimiento) => ({
          hora: horaFormateador.format(new Date(movimiento.creadoEn)),
          motivo: movimiento.motivo,
          tipo: movimiento.tipo === "ingreso" ? "Ingreso" : "Egreso",
          monto: movimiento.monto,
        })),
      );

      const buffer = await libro.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `caja-${fechaFormateador.format(new Date(turno.abiertoEn)).replaceAll("/", "-")}.xlsx`;
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
      <Boton type="button" variante="fantasma" onClick={exportar} disabled={exportando}>
        {exportando ? "Exportando…" : "Exportar Excel"}
      </Boton>
      {error && <p className="text-xs text-alerta">{error}</p>}
    </div>
  );
}
