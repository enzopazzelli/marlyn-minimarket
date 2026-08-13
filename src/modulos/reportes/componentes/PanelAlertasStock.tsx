import { Insignia } from "@/componentes/Insignia";
import type { Producto } from "@/modulos/stock/tipos";

// Mismo criterio que la columna "Estado" de ListaProductos.tsx en
// Stock — se repite acá en vez de importar de ahí porque es una sola
// comparación, no vale la pena una función compartida para eso.
export function PanelAlertasStock({ productos }: { productos: Producto[] }) {
  const productosBajos = productos.filter(
    (producto) => producto.activo && producto.stockActual <= producto.stockMinimo,
  );

  return (
    <div className="rounded-[var(--radius-base)] border border-linea bg-superficie p-4">
      <p className="mb-3 text-sm font-semibold text-texto">Alertas de stock</p>
      {productosBajos.length === 0 ? (
        <p className="py-8 text-center text-sm text-texto-suave">Todo el stock está en su nivel esperado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {productosBajos.map((producto) => (
            <li key={producto.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-texto">{producto.nombre}</span>
              <span className="flex items-center gap-2">
                <span className="numero text-xs text-texto-suave">{producto.stockActual} u</span>
                <Insignia variante="alerta">reponer</Insignia>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
