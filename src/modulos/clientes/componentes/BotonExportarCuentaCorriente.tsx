"use client";

import { useState } from "react";
import { Boton } from "@/componentes/Boton";
import { useEsDueño } from "@/lib/supabase/PerfilContext";
import type { MovimientoCuentaCorrienteDetallado } from "../consultas/clientes";
import type { Cliente } from "../tipos";

const fechaFormateador = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

const ETIQUETA_TIPO: Record<MovimientoCuentaCorrienteDetallado["tipo"], string> = {
  fiado: "Fiado",
  pago: "Pago",
  recargo: "Recargo",
};

// exceljs se importa dinámicamente, solo al hacer click — mismo
// criterio que el resto de los botones de export ya construidos.
export function BotonExportarCuentaCorriente({
  cliente,
  saldoActual,
  movimientos,
}: {
  cliente: Cliente;
  saldoActual: number;
  movimientos: MovimientoCuentaCorrienteDetallado[];
}) {
  const esDueño = useEsDueño();
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!esDueño) return null;

  async function exportar() {
    setError(null);
    setExportando(true);
    try {
      const { default: ExcelJS } = await import("exceljs");
      const libro = new ExcelJS.Workbook();

      const hojaResumen = libro.addWorksheet("Resumen");
      hojaResumen.columns = [
        { header: "Dato", key: "dato", width: 22 },
        { header: "Valor", key: "valor", width: 28 },
      ];
      hojaResumen.addRow({ dato: "Cliente", valor: cliente.nombre });
      hojaResumen.addRow({ dato: "Teléfono", valor: cliente.telefono ?? "" });
      hojaResumen.addRow({ dato: "Dirección", valor: cliente.direccion ?? "" });
      hojaResumen.addRow({ dato: "Debe", valor: saldoActual });

      const hojaMovimientos = libro.addWorksheet("Movimientos");
      hojaMovimientos.columns = [
        { header: "Fecha", key: "fecha", width: 12 },
        { header: "Tipo", key: "tipo", width: 12 },
        { header: "Nota", key: "nota", width: 26 },
        { header: "Productos", key: "productos", width: 42 },
        { header: "Monto", key: "monto", width: 14, style: { numFmt: '"$"#,##0.00' } },
      ];
      hojaMovimientos.addRows(
        movimientos.map((movimiento) => ({
          fecha: fechaFormateador.format(new Date(movimiento.creadoEn)),
          tipo: ETIQUETA_TIPO[movimiento.tipo],
          nota: movimiento.nota ?? "",
          productos: movimiento.items
            .map((item) => `${item.cantidad} × ${item.nombre}${item.eliminado ? " [Eliminado]" : ""}`)
            .join(", "),
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
      enlace.download = `cuenta-${cliente.nombre.trim().replace(/\s+/g, "-").toLowerCase()}.xlsx`;
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
      <Boton type="button" variante="fantasma" className="px-2.5 py-1.5 text-xs" onClick={exportar} disabled={exportando}>
        {exportando ? "Exportando…" : "Exportar"}
      </Boton>
      {error && <p className="text-xs text-alerta">{error}</p>}
    </div>
  );
}
