const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export type ItemTicket = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

// Portado del comprobante que se mostraba solo al confirmar una venta
// (PanelVentas.tsx) para reusarlo también al ver el ticket de una venta
// ya cerrada (TablaDetalleVentas.tsx, en /reportes). `encabezado` es
// opcional porque al confirmar una venta ya está todo a la vista
// (fecha, número); al revisar una venta pasada sí hace falta.
export function TicketVenta({
  encabezado,
  items,
  total,
  medioTexto,
  vuelto = 0,
}: {
  encabezado?: string;
  items: ItemTicket[];
  total: number;
  medioTexto: string;
  vuelto?: number;
}) {
  return (
    <div
      id="ticket-imprimible"
      className="rounded-[var(--radius-base)] bg-fondo p-4 font-[family-name:var(--font-numero)] text-xs leading-relaxed"
    >
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
    </div>
  );
}
