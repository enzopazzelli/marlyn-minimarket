"use client";

import { useMemo, useState } from "react";
import { Boton } from "@/componentes/Boton";
import { CapaImpresion } from "@/componentes/CapaImpresion";
import { Modal } from "@/componentes/Modal";
import type { Producto } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

// 2 columnas x 5 filas en A4 (10 por hoja) sobre papel/adhesivo liso,
// para cortar después — decidido con Enzo, 2026-08-15: no depende de
// ninguna hoja pre-troquelada puntual. Las medidas (95mm x 55mm) salen
// de repartir el área imprimible de A4 (210x297mm menos 10mm de margen
// por lado, @page etiquetas-a4 en globals.css) en 2x5 parejo.
const POR_HOJA = 10;
const ANCHO_ETIQUETA = "95mm";
const ALTO_ETIQUETA = "55mm";

function Etiqueta({ producto, saltoDePagina }: { producto: Producto; saltoDePagina: boolean }) {
  return (
    <div
      style={{ width: ANCHO_ETIQUETA, height: ALTO_ETIQUETA }}
      className={`flex flex-col items-center justify-center gap-2 border border-dashed border-linea p-3 text-center [break-inside:avoid] ${
        saltoDePagina ? "[break-after:page]" : ""
      }`}
    >
      <p className="text-sm font-semibold uppercase leading-tight text-texto">{producto.nombre}</p>
      <p className="numero text-2xl font-bold leading-none text-texto">{platita.format(producto.precioVenta)}</p>
    </div>
  );
}

// Selector de productos propio, separado del modo de selección de
// ListaProductos.tsx (que es específico para borrar) — mezclar los dos
// hubiera complicado ese estado para un caso de uso distinto.
export function EtiquetasProductos({ productos }: { productos: Producto[] }) {
  const [abierto, setAbierto] = useState(false);
  const [paso, setPaso] = useState<"elegir" | "vista">("elegir");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const activos = useMemo(() => productos.filter((producto) => producto.activo), [productos]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return activos;
    return activos.filter((producto) => producto.nombre.toLowerCase().includes(termino));
  }, [activos, busqueda]);

  const elegidos = useMemo(() => activos.filter((producto) => seleccionados.has(producto.id)), [activos, seleccionados]);

  function abrir() {
    setPaso("elegir");
    setBusqueda("");
    setSeleccionados(new Set());
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

  function alternar(id: string) {
    setSeleccionados((anteriores) => {
      const nuevo = new Set(anteriores);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  const hojas = Math.ceil(elegidos.length / POR_HOJA);

  return (
    <>
      <Boton type="button" variante="fantasma" className="px-2.5 py-1.5 text-xs" onClick={abrir}>
        Etiquetas
      </Boton>

      <Modal titulo="Generar etiquetas" abierto={abierto} onCerrar={cerrar}>
        {paso === "elegir" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-texto-suave">
              Elegí los productos que necesitás etiquetar. Se imprimen {POR_HOJA} por hoja A4.
            </p>
            <input
              className="rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-2 text-sm text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40"
              placeholder="Buscar producto..."
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
            />
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {filtrados.length === 0 ? (
                <p className="py-6 text-center text-sm text-texto-suave">Ningún producto coincide.</p>
              ) : (
                filtrados.map((producto) => (
                  <li key={producto.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-base)] px-2 py-1.5 hover:bg-fondo">
                      <input
                        type="checkbox"
                        checked={seleccionados.has(producto.id)}
                        onChange={() => alternar(producto.id)}
                        className="h-4 w-4 accent-acento"
                      />
                      <span className="flex-1 text-sm text-texto">{producto.nombre}</span>
                      <span className="numero text-xs text-texto-suave">{platita.format(producto.precioVenta)}</span>
                    </label>
                  </li>
                ))
              )}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-linea pt-3">
              <span className="text-xs text-texto-suave">{seleccionados.size} elegidos</span>
              <div className="flex gap-2">
                <Boton type="button" variante="fantasma" onClick={cerrar}>
                  Cancelar
                </Boton>
                <Boton
                  type="button"
                  variante="confirmar"
                  disabled={seleccionados.size === 0}
                  onClick={() => setPaso("vista")}
                >
                  Continuar
                </Boton>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-texto-suave">
              {elegidos.length} etiqueta{elegidos.length === 1 ? "" : "s"} — {hojas} hoja{hojas === 1 ? "" : "s"} A4.
            </p>

            {/* Vista previa en pantalla: mismas etiquetas, sin los
                saltos de página forzados (acá no hacen falta, es solo
                para revisar antes de imprimir). La que realmente se
                imprime es la copia portaleada de abajo — ver
                CapaImpresion.tsx y #etiquetas-imprimibles en
                globals.css. */}
            <div className="max-h-[55vh] overflow-auto rounded-[var(--radius-base)] border border-linea bg-fondo p-2">
              <div className="flex w-max flex-wrap bg-superficie">
                {elegidos.map((producto) => (
                  <Etiqueta key={producto.id} producto={producto} saltoDePagina={false} />
                ))}
              </div>
            </div>

            <CapaImpresion id="capa-impresion-etiquetas">
              <div id="etiquetas-imprimibles" className="flex flex-wrap bg-superficie">
                {elegidos.map((producto, indice) => (
                  <Etiqueta
                    key={producto.id}
                    producto={producto}
                    saltoDePagina={(indice + 1) % POR_HOJA === 0 && indice + 1 < elegidos.length}
                  />
                ))}
              </div>
            </CapaImpresion>

            <div className="flex justify-end gap-2 border-t border-linea pt-3">
              <Boton type="button" variante="fantasma" onClick={() => setPaso("elegir")}>
                Volver
              </Boton>
              <Boton type="button" variante="confirmar" onClick={() => window.print()}>
                Imprimir
              </Boton>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
