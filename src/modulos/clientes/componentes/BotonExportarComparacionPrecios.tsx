"use client";

import { useState } from "react";
import { Boton } from "@/componentes/Boton";
import { resumirActualizacion, type FilaComparacionPrecio } from "../consultas/actualizacionPrecios";
import type { Cliente } from "../tipos";

const fechaFormateador = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

// El "otro Excel" que pidió el dueño: precios como los sacó contra
// precios a la fecha del sistema, producto por producto. Aparte del
// export de la cuenta corriente entera (BotonExportarCuentaCorriente),
// que sigue siendo el historial de movimientos. exceljs se importa
// dinámicamente al hacer click, igual que el resto de los exports.
export function BotonExportarComparacionPrecios({
  cliente,
  filas,
}: {
  cliente: Cliente;
  filas: FilaComparacionPrecio[];
}) {
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportar() {
    setError(null);
    setExportando(true);
    try {
      const { default: ExcelJS } = await import("exceljs");
      const libro = new ExcelJS.Workbook();
      const resumen = resumirActualizacion(filas);
      const hoy = fechaFormateador.format(new Date());

      const hojaResumen = libro.addWorksheet("Resumen");
      hojaResumen.columns = [
        { header: "Dato", key: "dato", width: 34 },
        { header: "Valor", key: "valor", width: 28 },
      ];
      hojaResumen.addRow({ dato: "Cliente", valor: cliente.nombre });
      hojaResumen.addRow({ dato: "Precios comparados al", valor: hoy });
      hojaResumen.addRow({ dato: "Productos que subieron", valor: resumen.productosQueSubieron });
      hojaResumen.addRow({ dato: "Productos que bajaron", valor: resumen.productosQueBajaron });
      hojaResumen.addRow({ dato: "Productos sin cambio", valor: resumen.productosSinCambio });
      hojaResumen.addRow({
        dato: "A sumar a la cuenta (solo subas)",
        valor: resumen.totalAAplicar,
      }).getCell("valor").numFmt = '"$"#,##0.00';
      hojaResumen.addRow({
        dato: "Diferencia neta a precio de hoy",
        valor: resumen.totalNetoAPrecioDeHoy,
      }).getCell("valor").numFmt = '"$"#,##0.00';

      const hojaDetalle = libro.addWorksheet("Comparación de precios");
      hojaDetalle.columns = [
        { header: "Fecha", key: "fecha", width: 12 },
        { header: "Venta", key: "venta", width: 9 },
        { header: "Producto", key: "producto", width: 34 },
        { header: "Cantidad", key: "cantidad", width: 10 },
        { header: "Precio que sacó", key: "precioBase", width: 16, style: { numFmt: '"$"#,##0.00' } },
        { header: "Precio de hoy", key: "precioActual", width: 16, style: { numFmt: '"$"#,##0.00' } },
        { header: "Parte fiada", key: "proporcion", width: 12, style: { numFmt: "0%" } },
        { header: "Diferencia", key: "diferencia", width: 14, style: { numFmt: '"$"#,##0.00' } },
        { header: "Se cobra", key: "seCobra", width: 11 },
      ];
      hojaDetalle.addRows(
        filas.map((fila) => ({
          fecha: fechaFormateador.format(new Date(fila.fiadoEn)),
          venta: `#${fila.ventaNumero}`,
          producto: fila.producto,
          cantidad: fila.cantidad,
          precioBase: fila.precioBase,
          precioActual: fila.precioActual,
          proporcion: fila.proporcionFiada,
          diferencia: fila.diferencia,
          seCobra: fila.diferencia > 0 ? "Sí" : "No",
        })),
      );

      const buffer = await libro.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `precios-actualizados-${cliente.nombre.trim().replace(/\s+/g, "-").toLowerCase()}.xlsx`;
      enlace.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo generar el Excel. Probá de nuevo.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Boton
        type="button"
        variante="fantasma"
        className="px-2.5 py-1.5 text-xs"
        onClick={exportar}
        disabled={exportando || filas.length === 0}
      >
        {exportando ? "Exportando…" : "Exportar comparación"}
      </Boton>
      {error && <p className="text-xs text-alerta">{error}</p>}
    </div>
  );
}
