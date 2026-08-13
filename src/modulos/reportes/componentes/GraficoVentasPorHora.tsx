import type { ResumenDia } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function GraficoVentasPorHora({ puntos }: { puntos: ResumenDia["ventasPorHora"] }) {
  const maximo = Math.max(...puntos.map((punto) => punto.total), 1);

  return (
    <div className="rounded-[var(--radius-base)] border border-linea bg-superficie p-4">
      <p className="mb-3 text-sm font-semibold text-texto">Ventas por hora</p>
      {puntos.length === 0 ? (
        <p className="py-8 text-center text-sm text-texto-suave">Sin ventas este día.</p>
      ) : (
        <div className="flex h-40 items-end gap-1.5">
          {puntos.map((punto) => {
            const alturaPorcentaje = (punto.total / maximo) * 100;
            return (
              <div
                key={punto.hora}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                title={`${punto.hora}h — ${platita.format(punto.total)}`}
              >
                <div
                  className="w-full rounded-t-[4px] bg-grafico-1"
                  style={{ height: `${Math.max(alturaPorcentaje, punto.total > 0 ? 3 : 0)}%` }}
                />
                <span className="numero text-[10px] text-texto-suave">{punto.hora}h</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
