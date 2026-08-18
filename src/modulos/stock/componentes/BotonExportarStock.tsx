"use client";

import { useState } from "react";
import { Boton } from "@/componentes/Boton";
import type { Categoria, Producto, Proveedor } from "../tipos";

const ETIQUETA_UNIDAD: Record<Producto["unidad"], string> = { unidad: "Unidad", kg: "Kg", litro: "Litro" };

// exceljs se importa dinámicamente, solo al hacer click — mismo
// criterio que BotonExportarExcel.tsx en Reportes.
export function BotonExportarStock({
  productos,
  categorias,
  proveedores,
}: {
  productos: Producto[];
  categorias: Categoria[];
  proveedores: Proveedor[];
}) {
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportar() {
    setError(null);
    setExportando(true);
    try {
      const nombrePorCategoria = new Map(categorias.map((categoria) => [categoria.id, categoria.nombre]));
      const nombrePorProveedor = new Map(proveedores.map((proveedor) => [proveedor.id, proveedor.nombre]));

      const { default: ExcelJS } = await import("exceljs");
      const libro = new ExcelJS.Workbook();
      const hoja = libro.addWorksheet("Stock");
      hoja.columns = [
        { header: "Código de barras", key: "codigoBarras", width: 18 },
        { header: "Producto", key: "nombre", width: 34 },
        { header: "Rubro", key: "rubro", width: 20 },
        { header: "Proveedor", key: "proveedor", width: 22 },
        { header: "Precio costo", key: "precioCosto", width: 14, style: { numFmt: '"$"#,##0.00' } },
        { header: "Precio venta", key: "precioVenta", width: 14, style: { numFmt: '"$"#,##0.00' } },
        { header: "Stock actual", key: "stockActual", width: 12 },
        { header: "Stock mínimo", key: "stockMinimo", width: 12 },
        { header: "Unidad", key: "unidad", width: 10 },
      ];
      hoja.addRows(
        productos
          .filter((producto) => producto.activo)
          .map((producto) => ({
            codigoBarras: producto.codigoBarras ?? "",
            nombre: producto.nombre,
            rubro: producto.categoriaId ? (nombrePorCategoria.get(producto.categoriaId) ?? "") : "",
            proveedor: producto.proveedorId ? (nombrePorProveedor.get(producto.proveedorId) ?? "") : "",
            precioCosto: producto.precioCosto ?? undefined,
            precioVenta: producto.precioVenta,
            stockActual: producto.stockActual,
            stockMinimo: producto.stockMinimo,
            unidad: ETIQUETA_UNIDAD[producto.unidad],
          })),
      );

      const buffer = await libro.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `stock-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
