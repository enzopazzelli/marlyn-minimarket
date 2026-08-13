import type { ReactNode } from "react";
import type { MovimientoCaja } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const horaFormateador = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

// El detalle de lo que ya usa calcularEfectivoEsperado para el monto
// calculado al cerrar: cada venta en efectivo, cada pago de cuenta
// corriente cobrado en efectivo, y los retiros/ingresos manuales
// (FormularioMovimientoCaja.tsx, pasado acá como `accion` para que
// viva en el mismo encabezado). Sigue siendo un componente de
// servidor puro, igual que ListaVentasDelTurno — `accion` es lo único
// que trae interactividad, y vive en su propio componente cliente.
export function ListaMovimientosCaja({
  movimientos,
  accion,
}: {
  movimientos: MovimientoCaja[];
  accion?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-base)] border border-linea bg-superficie">
      <div className="flex items-center justify-between border-b border-linea px-4 py-3">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-texto">
          Movimientos de caja
        </h3>
        {accion}
      </div>
      {movimientos.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-texto-suave">Todavía no hay movimientos este turno.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Hora", "Motivo", "Monto"].map((columna) => (
                <th
                  key={columna}
                  className={`border-b border-linea px-3 py-1.5 font-[family-name:var(--font-numero)] text-[10px] font-medium uppercase tracking-wider text-texto-suave ${
                    columna === "Monto" ? "text-right" : "text-left"
                  }`}
                >
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {movimientos.map((movimiento) => (
              <tr key={movimiento.id} className="border-b border-linea last:border-b-0">
                <td className="numero px-3 py-2 text-xs text-texto-suave">
                  {horaFormateador.format(new Date(movimiento.creadoEn))}
                </td>
                <td className="px-3 py-2 text-xs text-texto">{movimiento.motivo}</td>
                <td
                  className={`numero px-3 py-2 text-right text-xs font-semibold ${
                    movimiento.tipo === "egreso" ? "text-alerta" : "text-ok"
                  }`}
                >
                  {movimiento.tipo === "egreso" ? "−" : "+"}
                  {platita.format(movimiento.monto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
