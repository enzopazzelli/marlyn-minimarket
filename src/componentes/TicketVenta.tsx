import { CapaImpresion } from "./CapaImpresion";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export type ItemTicket = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  // Monto exacto de esta línea cuando se vendió por monto (peso
  // fraccionario) en vez de por cantidad — cantidad × precioUnitario no
  // siempre reconstruye el monto tipeado exacto. Sin esto, se calcula
  // como siempre.
  subtotal?: number;
};

type PropsTicket = {
  encabezado?: string;
  items: ItemTicket[];
  total: number;
  medioTexto: string;
  vuelto?: number;
  // Solo cuando el fiado es parcial (se cobró algo ahora y el resto
  // queda en cuenta corriente) — un fiado completo no necesita esta
  // línea aparte, "Fiado" + el Total ya lo dicen todo.
  saldoFiado?: number;
  // Recargo por débito/crédito (pedido explícito del cliente,
  // 2026-08-24) — solo con recargo > 0 se muestra el desglose
  // Subtotal/Recargo; sin esto, "Total" ya es el subtotal de siempre.
  subtotal?: number;
  recargoPorcentaje?: number;
};

function contenidoTicket({
  encabezado,
  items,
  total,
  medioTexto,
  vuelto = 0,
  saldoFiado,
  subtotal,
  recargoPorcentaje,
}: PropsTicket) {
  const conRecargo = !!recargoPorcentaje && recargoPorcentaje > 0 && subtotal !== undefined;
  return (
    <>
      {encabezado && <p className="mb-2 text-center text-texto-suave">{encabezado}</p>}
      {items.map((item) => (
        <div key={item.productoId} className="flex justify-between gap-3">
          <span>
            {item.cantidad} × {item.nombre}
          </span>
          <span>{platita.format(item.subtotal ?? item.cantidad * item.precioUnitario)}</span>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-linea" />
      {conRecargo && (
        <>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{platita.format(subtotal!)}</span>
          </div>
          <div className="flex justify-between">
            <span>Recargo ({recargoPorcentaje}%)</span>
            <span>{platita.format(total - subtotal!)}</span>
          </div>
        </>
      )}
      <div className="flex justify-between text-sm font-semibold">
        <span>Total</span>
        <span>{platita.format(total)}</span>
      </div>
      <div className="flex justify-between text-texto-suave">
        <span>{medioTexto}</span>
        {vuelto > 0 && <span>Vuelto {platita.format(vuelto)}</span>}
      </div>
      {!!saldoFiado && (
        <div className="flex justify-between font-semibold">
          <span>Queda fiado</span>
          <span>{platita.format(saldoFiado)}</span>
        </div>
      )}
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
