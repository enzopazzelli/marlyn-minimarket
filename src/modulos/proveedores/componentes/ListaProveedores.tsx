"use client";

import { useMemo, useState } from "react";
import { BotonEliminarProveedor } from "./BotonEliminarProveedor";
import { FormularioEditarProveedor } from "./FormularioEditarProveedor";
import { PanelPedidoProveedor } from "./PanelPedidoProveedor";
import type { Producto } from "@/modulos/stock/tipos";
import type { Proveedor } from "../tipos";

const clasesFiltro =
  "rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-1.5 text-sm text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40";

export function ListaProveedores({ proveedores, productos }: { proveedores: Proveedor[]; productos: Producto[] }) {
  const [busqueda, setBusqueda] = useState("");

  const cantidadProductosPorProveedor = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const producto of productos) {
      if (!producto.proveedorId) continue;
      mapa.set(producto.proveedorId, (mapa.get(producto.proveedorId) ?? 0) + 1);
    }
    return mapa;
  }, [productos]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return proveedores;
    return proveedores.filter(
      (proveedor) =>
        proveedor.nombre.toLowerCase().includes(termino) ||
        (proveedor.contacto ?? "").toLowerCase().includes(termino),
    );
  }, [proveedores, busqueda]);

  return (
    <div className="flex flex-col gap-3">
      <input
        className={`${clasesFiltro} max-w-sm`}
        placeholder="Buscar por nombre o contacto..."
        value={busqueda}
        onChange={(evento) => setBusqueda(evento.target.value)}
      />

      <div className="overflow-x-auto rounded-[var(--radius-base)] border border-linea bg-superficie">
        {filtrados.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-texto-suave">
            No hay proveedores que coincidan con la búsqueda.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Proveedor", "Contacto", "Teléfono", "Productos", "Acciones"].map((columna) => (
                  <th
                    key={columna}
                    className={`border-b border-linea px-2.5 py-1.5 font-[family-name:var(--font-numero)] text-[10px] font-medium uppercase tracking-wider text-texto-suave ${
                      columna === "Productos" || columna === "Acciones" ? "text-right" : "text-left"
                    }`}
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((proveedor) => (
                <tr key={proveedor.id} className="border-b border-linea last:border-b-0">
                  <td className="px-2.5 py-1.5 text-xs font-semibold text-texto">{proveedor.nombre}</td>
                  <td className="px-2.5 py-1.5 text-xs text-texto-suave">{proveedor.contacto ?? "—"}</td>
                  <td className="numero px-2.5 py-1.5 text-xs text-texto-suave">{proveedor.telefono ?? "—"}</td>
                  <td className="numero px-2.5 py-1.5 text-right text-xs text-texto-suave">
                    {cantidadProductosPorProveedor.get(proveedor.id) ?? 0}
                  </td>
                  <td className="px-2.5 py-1.5">
                    <div className="flex items-center justify-end gap-3">
                      <PanelPedidoProveedor proveedor={proveedor} productos={productos} />
                      <FormularioEditarProveedor proveedor={proveedor} />
                      <BotonEliminarProveedor proveedor={proveedor} />
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
