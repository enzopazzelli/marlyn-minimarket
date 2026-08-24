"use client";

import { useState } from "react";
import { Boton } from "@/componentes/Boton";
import type { ResumenDia, VentaReporte } from "../tipos";

const fechaFormateador = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
const horaFormateador = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

const ETIQUETA_MEDIO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  fiado: "Fiado",
};

function medioTexto(venta: VentaReporte): string {
  return [...new Set(venta.pagos.map((pago) => ETIQUETA_MEDIO[pago.medio] ?? pago.medio))].join(" + ");
}

// exceljs se importa dinámicamente, solo al hacer click: es una
// dependencia pesada y este botón puede no usarse nunca en una visita.
export function BotonExportarExcel({
  fecha,
  resumen,
  ventas,
}: {
  fecha: string;
  resumen: ResumenDia;
  ventas: VentaReporte[];
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
      hojaProductos.addRows(
        resumen.topProductos.map((producto) => ({
          ...producto,
          nombre: `${producto.nombre}${producto.eliminado ? " [Eliminado]" : ""}`,
        })),
      );

      const hojaDetalle = libro.addWorksheet("Detalle de ventas");
      hojaDetalle.columns = [
        { header: "Fecha", key: "fecha", width: 12 },
        { header: "Hora", key: "hora", width: 8 },
        { header: "Venta", key: "venta", width: 8 },
        { header: "Cliente", key: "cliente", width: 22 },
        { header: "Producto", key: "producto", width: 32 },
        { header: "Cantidad", key: "cantidad", width: 12 },
        { header: "Precio unitario", key: "precioUnitario", width: 16, style: { numFmt: '"$"#,##0.00' } },
        { header: "Subtotal", key: "subtotal", width: 16, style: { numFmt: '"$"#,##0.00' } },
        { header: "Medio", key: "medio", width: 16 },
      ];
      for (const venta of ventas) {
        const fechaVenta = new Date(venta.creadoEn);
        for (const item of venta.items) {
          hojaDetalle.addRow({
            fecha: fechaFormateador.format(fechaVenta),
            hora: horaFormateador.format(fechaVenta),
            venta: venta.numero,
            cliente: venta.clienteNombre ?? "",
            producto: `${item.nombre}${item.eliminado ? " [Eliminado]" : ""}`,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: item.subtotal,
            medio: medioTexto(venta),
          });
        }
      }

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
