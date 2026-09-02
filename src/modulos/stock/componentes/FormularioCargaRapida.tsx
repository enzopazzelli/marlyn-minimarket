"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { coincideBusqueda } from "@/lib/busqueda";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import { coincideCodigoExacto, contieneCodigo } from "../consultas/codigosBarras";
import type { Producto } from "../tipos";

type Tipo = "entrada" | "salida";

type ItemCargado = {
  id: string;
  nombre: string;
  tipo: Tipo;
  cantidad: number;
};

function pasoDeStock(unidad: Producto["unidad"]) {
  return unidad === "unidad" ? "1" : "0.1";
}

// Pensado para reponer mercadería de varios productos seguidos (llega
// el pedido del proveedor) sin repetir el ciclo abrir modal → cargar →
// cerrar → buscar la fila siguiente en la tabla por cada uno. Cada
// producto se guarda al toque (registrar_ajuste_stock), pero la lista
// de productos no se refresca hasta cerrar — evita el parpadeo de
// recargar ~3000 filas entre un producto y el siguiente.
export function FormularioCargaRapida({ productos }: { productos: Producto[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null);
  const [tipo, setTipo] = useState<Tipo>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargados, setCargados] = useState<ItemCargado[]>([]);
  const [stockLocal, setStockLocal] = useState<Map<string, number>>(new Map());

  function stockDe(producto: Producto) {
    return stockLocal.get(producto.id) ?? producto.stockActual;
  }

  function abrir() {
    setBusqueda("");
    setSeleccionado(null);
    setTipo("entrada");
    setCantidad("");
    setMotivo("");
    setError(null);
    setCargados([]);
    setStockLocal(new Map());
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    if (cargados.length > 0) router.refresh();
  }

  const coincidencias = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return [];
    return productos
      .filter((producto) => coincideBusqueda(producto.nombre, busqueda) || contieneCodigo(producto, termino))
      .slice(0, 6);
  }, [productos, busqueda]);

  function elegir(producto: Producto) {
    setSeleccionado(producto);
    setBusqueda("");
    setTipo("entrada");
    setCantidad("");
    setMotivo("");
    setError(null);
  }

  function alBuscarSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const termino = busqueda.trim();
    if (!termino) return;

    // Coincidencia exacta de código de barras entra directo, sin
    // obligar a clickear en la lista — mismo criterio que el lector de
    // /ventas, para cuando se escanea en vez de escribir el nombre.
    const porCodigo = productos.find((producto) => coincideCodigoExacto(producto, termino));
    elegir(porCodigo ?? coincidencias[0]);
  }

  async function agregar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!seleccionado) return;
    setError(null);

    const cantidadNumero = Number(cantidad);
    if (!cantidad || !Number.isFinite(cantidadNumero) || cantidadNumero <= 0) {
      setError("La cantidad tiene que ser mayor a cero");
      return;
    }

    const stockActual = stockDe(seleccionado);
    if (tipo === "salida" && cantidadNumero > stockActual) {
      setError(`Solo hay ${stockActual} en góndola`);
      return;
    }

    if (tipo === "salida" && !motivo.trim()) {
      setError("Contá el motivo de la salida (rotura, vencido, corrección de conteo)");
      return;
    }

    setGuardando(true);
    const supabase = crearClienteNavegador();

    try {
      const { data, error: errorRpc } = await supabase.rpc("registrar_ajuste_stock", {
        p_producto_id: seleccionado.id,
        p_cantidad: cantidadNumero,
        p_tipo: tipo,
        p_motivo: motivo.trim() || null,
      });

      if (errorRpc) {
        setError(
          /stock suficiente/i.test(errorRpc.message)
            ? `Solo hay ${stockActual} en góndola`
            : "No se pudo guardar ese movimiento. Probá de nuevo.",
        );
        return;
      }

      const stockNuevoRpc = Number(data);
      const stockNuevo = Number.isFinite(stockNuevoRpc)
        ? stockNuevoRpc
        : stockActual + (tipo === "entrada" ? cantidadNumero : -cantidadNumero);

      setStockLocal((anterior) => new Map(anterior).set(seleccionado.id, stockNuevo));
      setCargados((anteriores) => [
        { id: crypto.randomUUID(), nombre: seleccionado.nombre, tipo, cantidad: cantidadNumero },
        ...anteriores,
      ]);

      setSeleccionado(null);
      setBusqueda("");
      setCantidad("");
      setMotivo("");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Boton type="button" variante="fantasma" className="px-2.5 py-1.5 text-xs" onClick={abrir}>
        Carga rápida
      </Boton>

      <Modal titulo="Carga rápida de stock" abierto={abierto} onCerrar={cerrar}>
        <div className="flex flex-col gap-4">
          {!seleccionado ? (
            <form onSubmit={alBuscarSubmit} className="flex flex-col gap-2">
              <Campo
                etiqueta="Buscar producto"
                id="carga-rapida-buscar"
                placeholder="Nombre o código de barras..."
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                autoComplete="off"
                autoFocus
              />
              {busqueda.trim() && (
                <div className="flex flex-col divide-y divide-linea rounded-[var(--radius-base)] border border-linea">
                  {coincidencias.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-texto-suave">Sin resultados.</p>
                  ) : (
                    coincidencias.map((producto) => (
                      <button
                        key={producto.id}
                        type="button"
                        onClick={() => elegir(producto)}
                        className="flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-fondo"
                      >
                        <span className="font-medium text-texto">{producto.nombre}</span>
                        <span className="numero text-xs text-texto-suave">{stockDe(producto)} en góndola</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={agregar} noValidate className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-texto">{seleccionado.nombre}</p>
                  <p className="text-xs text-texto-suave">
                    Hay <span className="numero font-semibold text-texto">{stockDe(seleccionado)}</span> en góndola
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSeleccionado(null)}
                  className="shrink-0 text-xs font-medium text-texto-suave underline decoration-dotted underline-offset-2 hover:text-texto"
                >
                  Cambiar producto
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Boton
                  type="button"
                  variante={tipo === "entrada" ? "confirmar" : "fantasma"}
                  onClick={() => setTipo("entrada")}
                >
                  Entrada
                </Boton>
                <Boton
                  type="button"
                  variante={tipo === "salida" ? "peligro" : "fantasma"}
                  onClick={() => setTipo("salida")}
                >
                  Salida
                </Boton>
              </div>

              <Campo
                etiqueta={tipo === "entrada" ? "¿Cuántas unidades entraron?" : "¿Cuántas unidades salieron?"}
                id="carga-rapida-cantidad"
                type="number"
                min={0}
                step={pasoDeStock(seleccionado.unidad)}
                value={cantidad}
                onChange={(evento) => setCantidad(evento.target.value)}
                className="font-[family-name:var(--font-numero)]"
                autoFocus
              />

              <Campo
                etiqueta={tipo === "salida" ? "Motivo" : "Motivo (opcional)"}
                id="carga-rapida-motivo"
                placeholder={tipo === "entrada" ? "Ej: compra a proveedor" : "Ej: rotura, vencido, conteo físico"}
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
              />

              {error && (
                <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
              )}

              <Boton type="submit" variante="confirmar" disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar y buscar el siguiente"}
              </Boton>
            </form>
          )}

          {cargados.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-linea pt-3">
              <p className="text-xs font-medium text-texto-suave">Cargado en esta sesión</p>
              <ul className="flex flex-col gap-1">
                {cargados.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-xs">
                    <span className="text-texto-suave">{item.nombre}</span>
                    <span className={`numero font-medium ${item.tipo === "entrada" ? "text-ok" : "text-alerta"}`}>
                      {item.tipo === "entrada" ? "+" : "−"}
                      {item.cantidad}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <Boton type="button" variante="fantasma" onClick={cerrar}>
              Cerrar
            </Boton>
          </div>
        </div>
      </Modal>
    </>
  );
}
