"use client";

import { useState } from "react";
import { Campo } from "@/componentes/Campo";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Producto } from "@/modulos/stock/tipos";
import { calcularResumenDelDia, hoyISO } from "../consultas/calculos";
import { obtenerVentasDelDia } from "../consultas/reportes";
import type { ResumenDia, VentaReporte } from "../tipos";
import { BotonDescargarBackup } from "./BotonDescargarBackup";
import { BotonExportarExcel } from "./BotonExportarExcel";
import { FilaKpis } from "./FilaKpis";
import { GraficoMedioPago } from "./GraficoMedioPago";
import { GraficoVentasPorHora } from "./GraficoVentasPorHora";
import { PanelAlertasStock } from "./PanelAlertasStock";
import { TablaDetalleVentas } from "./TablaDetalleVentas";
import { TablaTopProductos } from "./TablaTopProductos";

export function PanelReportes({
  fechaInicial,
  resumenInicial,
  ventasIniciales,
  productos,
}: {
  fechaInicial: string;
  resumenInicial: ResumenDia;
  ventasIniciales: VentaReporte[];
  productos: Producto[];
}) {
  // "Adjusting state when a prop changes" (mismo patrón que
  // FormularioEditarProducto.tsx / PanelCuentaCorriente.tsx): si la
  // página vuelve a traer datos del servidor (router.refresh() desde
  // otra pantalla), no debe pisar la fecha que el usuario ya eligió acá.
  const [fechaInicialVista, setFechaInicialVista] = useState(fechaInicial);
  const [fecha, setFecha] = useState(fechaInicial);
  const [resumen, setResumen] = useState(resumenInicial);
  const [ventas, setVentas] = useState(ventasIniciales);
  if (fechaInicial !== fechaInicialVista) {
    setFechaInicialVista(fechaInicial);
    setFecha(fechaInicial);
    setResumen(resumenInicial);
    setVentas(ventasIniciales);
  }

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiarFecha(nuevaFecha: string) {
    if (!nuevaFecha) return;
    setFecha(nuevaFecha);
    setCargando(true);
    setError(null);
    try {
      const supabase = crearClienteNavegador();
      const ventasNuevas = await obtenerVentasDelDia(supabase, nuevaFecha);
      setVentas(ventasNuevas);
      setResumen(calcularResumenDelDia(ventasNuevas));
    } catch {
      setError("No se pudo cargar ese día. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Campo
          etiqueta="Día"
          id="fechaReporte"
          type="date"
          value={fecha}
          max={hoyISO()}
          onChange={(evento) => cambiarFecha(evento.target.value)}
        />
        <div className="flex items-start gap-2">
          <BotonExportarExcel fecha={fecha} resumen={resumen} ventas={ventas} />
          <BotonDescargarBackup />
        </div>
      </div>

      {error && (
        <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
      )}

      <div className={`flex flex-col gap-4 transition-opacity ${cargando ? "opacity-50" : ""}`}>
        <FilaKpis resumen={resumen} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <GraficoVentasPorHora puntos={resumen.ventasPorHora} />
          <GraficoMedioPago distribucion={resumen.distribucionMedioPago} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TablaTopProductos productos={resumen.topProductos} />
          <PanelAlertasStock productos={productos} />
        </div>

        <TablaDetalleVentas ventas={ventas} />
      </div>
    </div>
  );
}
