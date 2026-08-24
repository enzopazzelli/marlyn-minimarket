"use client";

import { useState } from "react";
import { AccionesTicket } from "@/componentes/AccionesTicket";
import { Modal } from "@/componentes/Modal";
import { TicketVenta } from "@/componentes/TicketVenta";
import { formatearHora } from "@/lib/formato";
import type { VentaReporte } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

const ETIQUETA_MEDIO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  fiado: "Fiado",
};

// Para el ticket (80mm, angosto): solo la etiqueta, sin montos — "Vuelto"
// y "Queda fiado" ya dan el detalle que hace falta ahí.
function medioTexto(venta: VentaReporte): string {
  return [...new Set(venta.pagos.map((pago) => ETIQUETA_MEDIO[pago.medio] ?? pago.medio))].join(" + ");
}

// Para la tabla (pedido explícito del cliente): en una venta mixta o un
// fiado parcial, cuánto fue de cada medio — "Efectivo $2.000 +
// Transferencia $1.500" en vez de solo "Efectivo + Transferencia". Neto
// de vuelto (mismo criterio que calcularDistribucionMedioPago en
// consultas/calculos.ts): lo que la venta hace con cuánto se acredita a
// cada medio, no lo que el cliente entregó en mano. Con un solo pago no
// hace falta el monto acá — ya está en la columna "Total" de al lado.
function medioTextoConMontos(venta: VentaReporte): string {
  if (venta.pagos.length <= 1) return medioTexto(venta);
  return venta.pagos
    .map((pago) => `${ETIQUETA_MEDIO[pago.medio] ?? pago.medio} ${platita.format(pago.monto - pago.vuelto)}`)
    .join(" + ");
}

function productosTexto(venta: VentaReporte): string {
  const primeros = venta.items
    .slice(0, 2)
    .map((item) => `${item.cantidad} × ${item.nombre}${item.eliminado ? " [Eliminado]" : ""}`);
  const resto = venta.items.length - primeros.length;
  return resto > 0 ? `${primeros.join(", ")} y ${resto} más` : primeros.join(", ");
}

// Una fila por venta (no por ítem, para que entre en pantalla) — el
// detalle línea por ítem queda para el Excel exportado
// (BotonExportarExcel.tsx, hoja "Detalle de ventas") y para el ticket
// (ícono de acá, reconstruido con los mismos datos que ya trae
// `ventas` — no hace falta guardar el ticket aparte).
export function TablaDetalleVentas({ ventas }: { ventas: VentaReporte[] }) {
  const [ventaSeleccionada, setVentaSeleccionada] = useState<VentaReporte | null>(null);

  return (
    <div className="rounded-[var(--radius-base)] border border-linea bg-superficie p-4">
      <p className="mb-3 text-sm font-semibold text-texto">Detalle de ventas</p>
      {ventas.length === 0 ? (
        <p className="py-8 text-center text-sm text-texto-suave">Sin ventas este día.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Hora", "Cliente", "Productos", "Medio", "Total", ""].map((columna, indice) => (
                  <th
                    key={indice}
                    className={`border-b border-linea px-3 py-1.5 font-[family-name:var(--font-numero)] text-[10px] font-medium uppercase tracking-wider text-texto-suave ${
                      columna === "Total" || indice === 5 ? "text-right" : "text-left"
                    }`}
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ventas.map((venta) => (
                <tr key={venta.id} className="border-b border-linea last:border-b-0">
                  <td className="numero px-3 py-2 text-xs text-texto-suave">{formatearHora(venta.creadoEn)}</td>
                  <td className="px-3 py-2 text-xs text-texto">{venta.clienteNombre ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-texto-suave">{productosTexto(venta)}</td>
                  <td className="px-3 py-2 text-xs text-texto">{medioTextoConMontos(venta)}</td>
                  <td className="numero px-3 py-2 text-right text-xs font-semibold text-texto">
                    {platita.format(venta.total)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setVentaSeleccionada(venta)}
                        aria-label={`Ver ticket de la venta #${venta.numero}`}
                        title="Ver ticket"
                        className="rounded-[var(--radius-base)] p-1 text-texto-suave hover:bg-fondo hover:text-texto"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M6 3h12v18l-2.5-1.8L13 21l-1-1.8-1 1.8-2.5-1.8L6 21V3Z" />
                          <path d="M9 8h6M9 12h6" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        titulo="Ticket de venta"
        abierto={ventaSeleccionada !== null}
        onCerrar={() => setVentaSeleccionada(null)}
      >
        {ventaSeleccionada && (
          <div className="flex flex-col gap-3">
            <TicketVenta
              encabezado={`Venta #${ventaSeleccionada.numero} · ${formatearHora(ventaSeleccionada.creadoEn)}${
                ventaSeleccionada.clienteNombre ? ` · ${ventaSeleccionada.clienteNombre}` : ""
              }`}
              items={ventaSeleccionada.items.map((item) => ({
                productoId: item.productoId,
                nombre: item.eliminado ? `${item.nombre} [Eliminado]` : item.nombre,
                cantidad: item.cantidad,
                precioUnitario: item.precioUnitario,
                subtotal: item.subtotal,
              }))}
              total={ventaSeleccionada.total}
              medioTexto={medioTexto(ventaSeleccionada)}
              vuelto={ventaSeleccionada.pagos.reduce((suma, pago) => suma + pago.vuelto, 0)}
            />
            <AccionesTicket numeroVenta={ventaSeleccionada.numero} />
          </div>
        )}
      </Modal>
    </div>
  );
}
