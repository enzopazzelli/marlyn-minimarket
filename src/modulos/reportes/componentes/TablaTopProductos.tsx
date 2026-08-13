import type { ResumenDia } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export function TablaTopProductos({ productos }: { productos: ResumenDia["topProductos"] }) {
  const maximo = Math.max(...productos.map((producto) => producto.cantidad), 1);

  return (
    <div className="rounded-[var(--radius-base)] border border-linea bg-superficie p-4">
      <p className="mb-3 text-sm font-semibold text-texto">Productos más vendidos</p>
      {productos.length === 0 ? (
        <p className="py-8 text-center text-sm text-texto-suave">Sin ventas este día.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {productos.map((producto, indice) => (
            <li key={producto.productoId} className="relative overflow-hidden rounded-[var(--radius-base)] bg-fondo">
              <div
                className="absolute inset-y-0 left-0 bg-grafico-1/10"
                style={{ width: `${(producto.cantidad / maximo) * 100}%` }}
              />
              <div className="relative flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-texto">
                  <span className="numero text-texto-suave">{indice + 1}.</span> {producto.nombre}
                </span>
                <span className="numero shrink-0 text-texto-suave">
                  {producto.cantidad} u · {platita.format(producto.subtotal)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
