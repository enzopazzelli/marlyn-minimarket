import { formatearHora } from "@/lib/formato";
import type { TurnoCaja } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const fechaFormateador = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Componente de servidor puro, igual que ListaMovimientosCaja: se
// refresca solo cuando la página vuelve a pedir datos. Los montos de
// cierre ya quedaron congelados en la fila al cerrar
// (FormularioCerrarCaja.tsx), no se recalculan acá.
export function HistorialCierres({ turnos }: { turnos: TurnoCaja[] }) {
  return (
    <div className="rounded-[var(--radius-base)] border border-linea bg-superficie">
      <div className="border-b border-linea px-4 py-3">
        <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-texto">
          Historial de cierres
        </h3>
      </div>
      {turnos.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-texto-suave">Todavía no se cerró ningún turno.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Día", "Horario", "Apertura", "Debería haber", "Contado", "Diferencia"].map((columna, indice) => (
                  <th
                    key={columna}
                    className={`border-b border-linea px-3 py-1.5 font-[family-name:var(--font-numero)] text-[10px] font-medium uppercase tracking-wider text-texto-suave ${
                      indice >= 2 ? "text-right" : "text-left"
                    }`}
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turnos.map((turno) => {
                const calculado = turno.montoCierreCalculado ?? 0;
                const declarado = turno.montoCierreDeclarado ?? 0;
                const diferencia = declarado - calculado;

                return (
                  <tr key={turno.id} className="border-b border-linea last:border-b-0">
                    <td className="px-3 py-2 text-xs text-texto">
                      {fechaFormateador.format(new Date(turno.abiertoEn))}
                    </td>
                    <td className="numero px-3 py-2 text-xs text-texto-suave">
                      {formatearHora(turno.abiertoEn)} – {turno.cerradoEn ? formatearHora(turno.cerradoEn) : "—"}
                    </td>
                    <td className="numero px-3 py-2 text-right text-xs text-texto-suave">
                      {platita.format(turno.montoApertura)}
                    </td>
                    <td className="numero px-3 py-2 text-right text-xs text-texto-suave">
                      {platita.format(calculado)}
                    </td>
                    <td className="numero px-3 py-2 text-right text-xs text-texto">{platita.format(declarado)}</td>
                    <td
                      className={`numero px-3 py-2 text-right text-xs font-semibold ${
                        diferencia === 0 ? "text-texto-suave" : diferencia > 0 ? "text-ok" : "text-alerta"
                      }`}
                    >
                      {diferencia === 0
                        ? "Justo"
                        : diferencia > 0
                          ? `+${platita.format(diferencia)}`
                          : `−${platita.format(Math.abs(diferencia))}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
