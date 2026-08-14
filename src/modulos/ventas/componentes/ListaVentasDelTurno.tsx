import { Insignia } from "@/componentes/Insignia";
import { formatearHora } from "@/lib/formato";
import type { VentaResumen } from "../consultas/ventas";
import { BotonAnularVenta } from "./BotonAnularVenta";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

// Número, hora, cómo pagó, total, y "Anular" (BotonAnularVenta, client
// component) para las que siguen confirmadas — el resumen de arriba
// (cantidad y total) solo cuenta esas, una anulada no es una venta
// real aunque se siga mostrando en la lista para el registro. Server
// component en sí: se refresca solo cada vez que la página que lo usa
// hace router.refresh() (lo dispara BotonAnularVenta al confirmar).
export function ListaVentasDelTurno({ ventas }: { ventas: VentaResumen[] }) {
  const confirmadas = ventas.filter((venta) => venta.estado === "confirmada");

  return (
    <div className="rounded-[var(--radius-base)] border border-linea bg-superficie">
      <div className="flex items-center justify-between border-b border-linea px-4 py-3">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-texto">
          Ventas de este turno
        </h3>
        <span className="numero text-xs text-texto-suave">
          {confirmadas.length} · {platita.format(confirmadas.reduce((suma, venta) => suma + venta.total, 0))}
        </span>
      </div>
      {ventas.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-texto-suave">Todavía no se registró ninguna venta.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Venta", "Hora", "Cómo pagó", "Total", ""].map((columna, indice) => (
                <th
                  key={indice}
                  className={`border-b border-linea px-3 py-1.5 font-[family-name:var(--font-numero)] text-[10px] font-medium uppercase tracking-wider text-texto-suave ${
                    columna === "Total" || indice === 4 ? "text-right" : "text-left"
                  }`}
                >
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ventas.map((venta) => (
              <tr
                key={venta.id}
                className={`border-b border-linea last:border-b-0 ${venta.estado === "anulada" ? "opacity-50" : ""}`}
              >
                <td className="numero px-3 py-2 text-xs text-texto-suave">#{venta.numero}</td>
                <td className="numero px-3 py-2 text-xs text-texto-suave">{formatearHora(venta.creadoEn)}</td>
                <td className="px-3 py-2 text-xs text-texto">
                  {venta.medioTexto}
                  {venta.clienteNombre ? ` — ${venta.clienteNombre}` : ""}
                </td>
                <td className="numero px-3 py-2 text-right text-xs font-semibold text-texto">
                  {platita.format(venta.total)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end">
                    {venta.estado === "anulada" ? (
                      <Insignia variante="alerta">anulada</Insignia>
                    ) : (
                      <BotonAnularVenta ventaId={venta.id} numero={venta.numero} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
