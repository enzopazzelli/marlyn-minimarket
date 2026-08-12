"use client";

import { useMemo, useState } from "react";
import { Insignia } from "@/componentes/Insignia";
import { FormularioEditarProducto } from "./FormularioEditarProducto";
import { FormularioIngresoMercaderia } from "./FormularioIngresoMercaderia";
import type { Categoria, Producto } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

const clasesFiltro =
  "rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-1.5 text-sm text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40";

type FiltroEstado = "todos" | "ok" | "reponer";

export function ListaProductos({
  productos,
  categorias,
}: {
  productos: Producto[];
  categorias: Categoria[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [rubroId, setRubroId] = useState("");
  const [estado, setEstado] = useState<FiltroEstado>("todos");

  const nombrePorCategoria = useMemo(
    () => new Map(categorias.map((categoria) => [categoria.id, categoria.nombre])),
    [categorias],
  );

  const paraReponer = useMemo(
    () => productos.filter((producto) => producto.stockActual <= producto.stockMinimo),
    [productos],
  );

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();

    return productos.filter((producto) => {
      const rubro = producto.categoriaId ? (nombrePorCategoria.get(producto.categoriaId) ?? "") : "";
      const coincideBusqueda =
        !termino ||
        producto.nombre.toLowerCase().includes(termino) ||
        (producto.codigoBarras ?? "").includes(termino) ||
        rubro.toLowerCase().includes(termino);

      const coincideRubro = !rubroId || producto.categoriaId === rubroId;

      const reponer = producto.stockActual <= producto.stockMinimo;
      const coincideEstado = estado === "todos" || (estado === "reponer" ? reponer : !reponer);

      return coincideBusqueda && coincideRubro && coincideEstado;
    });
  }, [productos, busqueda, rubroId, estado, nombrePorCategoria]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${clasesFiltro} min-w-[220px] flex-1`}
          placeholder="Buscar por nombre, código o rubro..."
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
        />
        <select
          className={clasesFiltro}
          value={rubroId}
          onChange={(evento) => setRubroId(evento.target.value)}
        >
          <option value="">Todos los rubros</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
            </option>
          ))}
        </select>
        <select
          className={clasesFiltro}
          value={estado}
          onChange={(evento) => setEstado(evento.target.value as FiltroEstado)}
        >
          <option value="todos">Todos los estados</option>
          <option value="ok">Ok</option>
          <option value="reponer">Para reponer</option>
        </select>
        <span className="ml-auto whitespace-nowrap text-xs text-texto-suave">
          {filtrados.length} de {productos.length} productos · {paraReponer.length} para reponer
        </span>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-base)] border border-linea bg-superficie">
        {filtrados.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-texto-suave">
            No hay productos que coincidan con la búsqueda.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Código", "Producto", "Rubro", "Precio", "Stock", "Estado", "Acciones"].map((columna) => (
                  <th
                    key={columna}
                    className={`border-b border-linea px-2.5 py-1.5 font-[family-name:var(--font-numero)] text-[10px] font-medium uppercase tracking-wider text-texto-suave ${
                      columna === "Precio" || columna === "Stock" || columna === "Estado" || columna === "Acciones"
                        ? "text-right"
                        : "text-left"
                    }`}
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((producto) => {
                const reponer = producto.stockActual <= producto.stockMinimo;
                return (
                  <tr key={producto.id} className="border-b border-linea last:border-b-0">
                    <td className="numero px-2.5 py-1.5 text-xs text-texto-suave">
                      {producto.codigoBarras ?? "—"}
                    </td>
                    <td className="px-2.5 py-1.5 text-xs font-semibold text-texto">{producto.nombre}</td>
                    <td className="px-2.5 py-1.5 text-xs text-texto-suave">
                      {producto.categoriaId ? (nombrePorCategoria.get(producto.categoriaId) ?? "—") : "—"}
                    </td>
                    <td className="numero px-2.5 py-1.5 text-right text-xs">
                      {platita.format(producto.precioVenta)}
                    </td>
                    <td className="numero px-2.5 py-1.5 text-right text-xs">{producto.stockActual}</td>
                    <td className="px-2.5 py-1.5 text-right">
                      <Insignia variante={reponer ? "alerta" : "ok"}>{reponer ? "reponer" : "ok"}</Insignia>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center justify-end gap-3">
                        <FormularioIngresoMercaderia producto={producto} />
                        <FormularioEditarProducto producto={producto} categoriasIniciales={categorias} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
