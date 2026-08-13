import type { VentaResumen } from "../consultas/ventas";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const horaFormateador = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

// Solo lectura (anular venta queda para otro cambio): número, hora,
// cómo pagó y total. Componente de servidor puro — se refresca solo
// cada vez que la página que lo usa hace router.refresh().
export function ListaVentasDelTurno({ ventas }: { ventas: VentaResumen[] }) {
  return (
    <div className="rounded-[var(--radius-base)] border border-linea bg-superficie">
      <div className="flex items-center justify-between border-b border-linea px-4 py-3">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-texto">
          Ventas de este turno
        </h3>
        <span className="numero text-xs text-texto-suave">
          {ventas.length} · {platita.format(ventas.reduce((suma, venta) => suma + venta.total, 0))}
        </span>
      </div>
      {ventas.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-texto-suave">Todavía no se registró ninguna venta.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Venta", "Hora", "Cómo pagó", "Total"].map((columna) => (
                <th
                  key={columna}
                  className={`border-b border-linea px-3 py-1.5 font-[family-name:var(--font-numero)] text-[10px] font-medium uppercase tracking-wider text-texto-suave ${
                    columna === "Total" ? "text-right" : "text-left"
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
                <td className="numero px-3 py-2 text-xs text-texto-suave">#{venta.numero}</td>
                <td className="numero px-3 py-2 text-xs text-texto-suave">
                  {horaFormateador.format(new Date(venta.creadoEn))}
                </td>
                <td className="px-3 py-2 text-xs text-texto">
                  {venta.medioTexto}
                  {venta.clienteNombre ? ` — ${venta.clienteNombre}` : ""}
                </td>
                <td className="numero px-3 py-2 text-right text-xs font-semibold text-texto">
                  {platita.format(venta.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
