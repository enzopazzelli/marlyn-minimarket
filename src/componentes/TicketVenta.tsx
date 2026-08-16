import { CapaImpresion } from "./CapaImpresion";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export type ItemTicket = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

type PropsTicket = {
  encabezado?: string;
  items: ItemTicket[];
  total: number;
  medioTexto: string;
  vuelto?: number;
};

function contenidoTicket({ encabezado, items, total, medioTexto, vuelto = 0 }: PropsTicket) {
  return (
    <>
      {encabezado && <p className="mb-2 text-center text-texto-suave">{encabezado}</p>}
      {items.map((item) => (
        <div key={item.productoId} className="flex justify-between gap-3">
          <span>
            {item.cantidad} × {item.nombre}
          </span>
          <span>{platita.format(item.cantidad * item.precioUnitario)}</span>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-linea" />
      <div className="flex justify-between text-sm font-semibold">
        <span>Total</span>
        <span>{platita.format(total)}</span>
      </div>
      <div className="flex justify-between text-texto-suave">
        <span>{medioTexto}</span>
        {vuelto > 0 && <span>Vuelto {platita.format(vuelto)}</span>}
      </div>
      <p className="mt-2 text-center text-[10px] text-texto-suave">Documento no válido como factura</p>
    </>
  );
}

// Portado del comprobante que se mostraba solo al confirmar una venta
// (PanelVentas.tsx) para reusarlo también al ver el ticket de una venta
// ya cerrada (TablaDetalleVentas.tsx, en /reportes). `encabezado` es
// opcional porque al confirmar una venta ya está todo a la vista
// (fecha, número); al revisar una venta pasada sí hace falta.
//
// Se renderiza dos veces con el mismo contenido: la copia visible
// (dentro del Modal, para que el cajero la vea) y una copia gemela
// portaleada a <body> vía CapaImpresion — esa segunda es la que
// #ticket-imprimible aísla en @media print (ver globals.css). No
// alcanza con una sola copia porque la que se ve en pantalla vive dentro
// del Modal, y aislar justo esa para imprimir requeriría el viejo truco
// de position:fixed que no pagina bien contenido largo (encontrado con
// las etiquetas de góndola).
export function TicketVenta(props: PropsTicket) {
  return (
    <>
      <div className="rounded-[var(--radius-base)] bg-fondo p-4 font-[family-name:var(--font-numero)] text-xs leading-relaxed">
        {contenidoTicket(props)}
      </div>
      <CapaImpresion id="capa-impresion-ticket">
        <div
          id="ticket-imprimible"
          className="bg-fondo p-4 font-[family-name:var(--font-numero)] text-xs leading-relaxed"
        >
          {contenidoTicket(props)}
        </div>
      </CapaImpresion>
    </>
  );
}
