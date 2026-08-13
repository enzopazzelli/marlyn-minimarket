import type { ResumenDia } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

// Slots fijos de la paleta de gráficos (tema.css): el orden no se
// reordena, es lo que mantiene los tonos distinguibles con daltonismo.
const COLORES = ["bg-grafico-1", "bg-grafico-2", "bg-grafico-3", "bg-grafico-4"];

export function GraficoMedioPago({ distribucion }: { distribucion: ResumenDia["distribucionMedioPago"] }) {
  return (
    <div className="rounded-[var(--radius-base)] border border-linea bg-superficie p-4">
      <p className="mb-3 text-sm font-semibold text-texto">Medios de pago</p>
      {distribucion.length === 0 ? (
        <p className="py-8 text-center text-sm text-texto-suave">Sin ventas este día.</p>
      ) : (
        <>
          <div className="flex h-6 gap-0.5 overflow-hidden rounded-[var(--radius-base)] bg-superficie">
            {distribucion.map((fila, indice) => (
              <div
                key={fila.medio}
                className={`${COLORES[indice % COLORES.length]} flex items-center justify-center`}
                style={{ width: `${fila.porcentaje}%` }}
                title={`${fila.medio}: ${platita.format(fila.monto)}`}
              >
                {fila.porcentaje >= 12 && (
                  <span className="numero text-[10px] font-semibold text-white">{fila.porcentaje}%</span>
                )}
              </div>
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {distribucion.map((fila, indice) => (
              <li key={fila.medio} className="flex items-center gap-1.5 text-xs text-texto-suave">
                <span className={`h-2.5 w-2.5 rounded-full ${COLORES[indice % COLORES.length]}`} />
                {fila.medio} · <span className="numero">{platita.format(fila.monto)}</span> ({fila.porcentaje}%)
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
