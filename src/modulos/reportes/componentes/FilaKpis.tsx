import type { ResumenDia } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

// "Transacciones" cubre lo que en el pedido original aparecía como
// "Cantidad de Transacciones / Clientes atendidos": la mayoría de las
// ventas son de mostrador, sin cliente cargado, así que contar
// cliente_id distintos no sería representativo.
export function FilaKpis({ resumen }: { resumen: ResumenDia }) {
  const tarjetas: { etiqueta: string; valor: string; negativo?: boolean }[] = [
    { etiqueta: "Ventas", valor: platita.format(resumen.totalVentas) },
    { etiqueta: "Ticket promedio", valor: platita.format(resumen.ticketPromedio) },
    { etiqueta: "Transacciones", valor: String(resumen.cantidadTransacciones) },
    {
      etiqueta: "Balance",
      valor: platita.format(resumen.margenBruto),
      negativo: resumen.margenBruto < 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tarjetas.map((tarjeta) => (
        <div key={tarjeta.etiqueta} className="rounded-[var(--radius-base)] border border-linea bg-superficie p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">{tarjeta.etiqueta}</p>
          <p className={`numero mt-1 text-2xl font-semibold ${tarjeta.negativo ? "text-alerta" : "text-texto"}`}>
            {tarjeta.valor}
          </p>
        </div>
      ))}
    </div>
  );
}
