import type { VentaReporte } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const horaFormateador = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

const ETIQUETA_MEDIO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  qr: "QR",
  fiado: "Fiado",
};

function medioTexto(venta: VentaReporte): string {
  return [...new Set(venta.pagos.map((pago) => ETIQUETA_MEDIO[pago.medio] ?? pago.medio))].join(" + ");
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
// (BotonExportarExcel.tsx, hoja "Detalle de ventas").
export function TablaDetalleVentas({ ventas }: { ventas: VentaReporte[] }) {
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
                {["Hora", "Cliente", "Productos", "Medio", "Total"].map((columna) => (
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
                  <td className="numero px-3 py-2 text-xs text-texto-suave">
                    {horaFormateador.format(new Date(venta.creadoEn))}
                  </td>
                  <td className="px-3 py-2 text-xs text-texto">{venta.clienteNombre ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-texto-suave">{productosTexto(venta)}</td>
                  <td className="px-3 py-2 text-xs text-texto">{medioTexto(venta)}</td>
                  <td className="numero px-3 py-2 text-right text-xs font-semibold text-texto">
                    {platita.format(venta.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
