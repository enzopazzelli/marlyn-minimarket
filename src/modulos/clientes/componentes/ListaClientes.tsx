"use client";

import { useMemo, useState } from "react";
import { FormularioEditarCliente } from "./FormularioEditarCliente";
import { PanelCuentaCorriente } from "./PanelCuentaCorriente";
import type { Cliente } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

const clasesFiltro =
  "rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-1.5 text-sm text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40";

export function ListaClientes({
  clientes,
  turnoCajaId,
}: {
  clientes: Cliente[];
  turnoCajaId: string | null;
}) {
  const [busqueda, setBusqueda] = useState("");

  const totalFiado = useMemo(
    () => clientes.reduce((suma, cliente) => suma + cliente.saldoCuentaCorriente, 0),
    [clientes],
  );

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return clientes;
    return clientes.filter(
      (cliente) =>
        cliente.nombre.toLowerCase().includes(termino) || (cliente.telefono ?? "").includes(termino),
    );
  }, [clientes, busqueda]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid max-w-lg grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-base)] border border-linea bg-superficie p-4">
          <p className="text-xs uppercase tracking-wide text-texto-suave">Total fiado</p>
          <p className="numero text-xl font-semibold text-alerta">{platita.format(totalFiado)}</p>
        </div>
        <div className="rounded-[var(--radius-base)] border border-linea bg-superficie p-4">
          <p className="text-xs uppercase tracking-wide text-texto-suave">Clientes con saldo</p>
          <p className="numero text-xl font-semibold text-texto">
            {clientes.filter((cliente) => cliente.saldoCuentaCorriente > 0).length}
          </p>
        </div>
      </div>

      <input
        className={`${clasesFiltro} max-w-sm`}
        placeholder="Buscar por nombre o teléfono..."
        value={busqueda}
        onChange={(evento) => setBusqueda(evento.target.value)}
      />

      <div className="overflow-x-auto rounded-[var(--radius-base)] border border-linea bg-superficie">
        {filtrados.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-texto-suave">
            No hay clientes que coincidan con la búsqueda.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Cliente", "Teléfono", "Debe", "Acciones"].map((columna) => (
                  <th
                    key={columna}
                    className={`border-b border-linea px-2.5 py-1.5 font-[family-name:var(--font-numero)] text-[10px] font-medium uppercase tracking-wider text-texto-suave ${
                      columna === "Debe" || columna === "Acciones" ? "text-right" : "text-left"
                    }`}
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((cliente) => (
                <tr key={cliente.id} className="border-b border-linea last:border-b-0">
                  <td className="px-2.5 py-1.5 text-xs font-semibold text-texto">{cliente.nombre}</td>
                  <td className="numero px-2.5 py-1.5 text-xs text-texto-suave">{cliente.telefono ?? "—"}</td>
                  <td
                    className={`numero px-2.5 py-1.5 text-right text-xs font-semibold ${
                      cliente.saldoCuentaCorriente > 0 ? "text-alerta" : "text-ok"
                    }`}
                  >
                    {cliente.saldoCuentaCorriente > 0
                      ? platita.format(cliente.saldoCuentaCorriente)
                      : cliente.saldoCuentaCorriente < 0
                        ? `A favor ${platita.format(Math.abs(cliente.saldoCuentaCorriente))}`
                        : "Al día"}
                  </td>
                  <td className="px-2.5 py-1.5">
                    <div className="flex items-center justify-end gap-3">
                      <PanelCuentaCorriente cliente={cliente} turnoCajaId={turnoCajaId} />
                      <FormularioEditarCliente cliente={cliente} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
