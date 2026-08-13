"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import {
  calcularTotalCarrito,
  calcularVuelto,
  pagosCubrenElTotal,
} from "../consultas/calculos";
import type { Cliente } from "@/modulos/clientes/tipos";
import type { Producto } from "@/modulos/stock/tipos";
import type { ItemCarrito, MedioPago, PagoCarrito } from "../tipos";
import { FilaCarritoItem } from "./FilaCarritoItem";

const ETIQUETA_UNIDAD: Record<Producto["unidad"], string> = {
  unidad: "unidades",
  kg: "kg",
  litro: "L",
};

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const CLAVE_SESSION = "ventas-carritos-en-curso";

const clasesSelect =
  "rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-2 text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40";
const clasesFiltro =
  "rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-1.5 text-sm text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40";

// "Mixto" no es un medio propio en la base (ventas_pagos.medio solo
// admite efectivo/transferencia/qr/fiado): son dos filas de pago. Acá
// es una opción más de UI que arma esas dos filas al confirmar.
type MedioPagoUi = MedioPago | "mixto";

const CLIENTE_NUEVO = "__nuevo__";

type CarritoEnCurso = {
  id: string;
  items: ItemCarrito[];
  medioPago: MedioPagoUi;
  pagaCon: string;
  montoMixtoEfectivo: string;
  clienteId: string;
  nombreClienteNuevo: string;
};

type Comprobante = {
  items: ItemCarrito[];
  total: number;
  medioTexto: string;
  vuelto: number;
};

function crearCarritoVacio(): CarritoEnCurso {
  return {
    id: crypto.randomUUID(),
    items: [],
    medioPago: "efectivo",
    pagaCon: "",
    montoMixtoEfectivo: "",
    clienteId: "",
    nombreClienteNuevo: "",
  };
}

function cargarCarritosGuardados(): CarritoEnCurso[] {
  if (typeof window === "undefined") return [crearCarritoVacio()];
  try {
    const guardado = window.sessionStorage.getItem(CLAVE_SESSION);
    const carritos = guardado ? (JSON.parse(guardado) as CarritoEnCurso[]) : null;
    return carritos && carritos.length > 0 ? carritos : [crearCarritoVacio()];
  } catch {
    return [crearCarritoVacio()];
  }
}

export function PanelVentas({
  productos,
  clientes,
  turnoCajaId,
}: {
  productos: Producto[];
  clientes: Cliente[];
  turnoCajaId: string;
}) {
  const router = useRouter();
  // "Adjusting state when a prop changes" (react.dev) — mismo patrón que
  // categorías/proveedores en los formularios de Stock: crear un
  // cliente nuevo acá adentro lo agrega a esta lista local al toque, y
  // un router.refresh() (por cualquier otro motivo) no la pisa con una
  // desactualizada.
  const [clientesVistos, setClientesVistos] = useState(clientes);
  const [listaClientes, setListaClientes] = useState(clientes);
  if (clientes !== clientesVistos) {
    setClientesVistos(clientes);
    setListaClientes(clientes);
  }

  const [carritos, setCarritos] = useState<CarritoEnCurso[]>(cargarCarritosGuardados);
  const [carritoActivoId, setCarritoActivoId] = useState(() => carritos[0].id);
  const [busqueda, setBusqueda] = useState("");
  const [codigoLector, setCodigoLector] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [comprobante, setComprobante] = useState<Comprobante | null>(null);

  // Cada pestaña de venta es su propio carrito independiente: cambiar de
  // pestaña ES "guardar para después" (el pedido del cliente), y también
  // resuelve atender a dos personas a la vez desde la misma PC — misma
  // necesidad, mismo mecanismo. Se guarda en sessionStorage (no
  // localStorage: es de esta pestaña del navegador, no algo que deba
  // sobrevivir a cerrarla) para no perder una venta ante un F5 sin querer.
  useEffect(() => {
    window.sessionStorage.setItem(CLAVE_SESSION, JSON.stringify(carritos));
  }, [carritos]);

  const carritoActivo = carritos.find((carrito) => carrito.id === carritoActivoId) ?? carritos[0];

  function actualizarCarritoActivo(cambios: Partial<CarritoEnCurso>) {
    setCarritos((anteriores) =>
      anteriores.map((carrito) => (carrito.id === carritoActivoId ? { ...carrito, ...cambios } : carrito)),
    );
  }

  function nuevaVenta() {
    const carrito = crearCarritoVacio();
    setCarritos((anteriores) => [...anteriores, carrito]);
    setCarritoActivoId(carrito.id);
    setError(null);
  }

  function cerrarVenta(id: string) {
    setCarritos((anteriores) => {
      if (anteriores.length === 1) return [crearCarritoVacio()];
      const restantes = anteriores.filter((carrito) => carrito.id !== id);
      if (id === carritoActivoId) setCarritoActivoId(restantes[0].id);
      return restantes;
    });
  }

  const total = useMemo(() => calcularTotalCarrito(carritoActivo.items), [carritoActivo.items]);

  function agregarProducto(producto: Producto) {
    setError(null);
    const enCarrito = carritoActivo.items.find((item) => item.productoId === producto.id);
    const yaCargadas = enCarrito?.cantidad ?? 0;

    if (yaCargadas + 1 > producto.stockActual) {
      setError(`Quedan ${producto.stockActual} ${ETIQUETA_UNIDAD[producto.unidad]} de ${producto.nombre}`);
      return;
    }

    const items = enCarrito
      ? carritoActivo.items.map((item) =>
          item.productoId === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item,
        )
      : [
          ...carritoActivo.items,
          {
            productoId: producto.id,
            nombre: producto.nombre,
            cantidad: 1,
            precioUnitario: producto.precioVenta,
          },
        ];

    actualizarCarritoActivo({ items });
  }

  function cambiarCantidad(productoId: string, delta: number) {
    const producto = productos.find((p) => p.id === productoId);
    const item = carritoActivo.items.find((i) => i.productoId === productoId);
    if (!item || !producto) return;

    if (item.cantidad + delta > producto.stockActual) {
      setError(`No hay más stock de ${producto.nombre}`);
      return;
    }

    const items =
      item.cantidad + delta <= 0
        ? carritoActivo.items.filter((i) => i.productoId !== productoId)
        : carritoActivo.items.map((i) =>
            i.productoId === productoId ? { ...i, cantidad: i.cantidad + delta } : i,
          );

    actualizarCarritoActivo({ items });
  }

  // Para productos por kg/litro: la cantidad se edita directa (no hay
  // un "−" natural que llegue a 0), así que sacar la fila es una acción
  // aparte (quitarProducto) en vez de decrementar hasta cero.
  function cambiarCantidadExacta(productoId: string, cantidad: number) {
    const producto = productos.find((p) => p.id === productoId);
    if (!producto) return;

    if (cantidad > producto.stockActual) {
      setError(`Quedan ${producto.stockActual} ${ETIQUETA_UNIDAD[producto.unidad]} de ${producto.nombre}`);
      return;
    }

    const items = carritoActivo.items.map((item) =>
      item.productoId === productoId ? { ...item, cantidad } : item,
    );
    actualizarCarritoActivo({ items });
  }

  function quitarProducto(productoId: string) {
    const items = carritoActivo.items.filter((item) => item.productoId !== productoId);
    actualizarCarritoActivo({ items });
  }

  function leerCodigo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const codigo = codigoLector.trim();
    if (!codigo) return;

    const producto = productos.find((p) => p.activo && p.codigoBarras === codigo);
    if (!producto) {
      setError("No hay ningún producto con ese código");
      return;
    }
    agregarProducto(producto);
    setCodigoLector("");
  }

  const productosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return productos
      .filter(
        (producto) =>
          producto.activo &&
          (!termino ||
            producto.nombre.toLowerCase().includes(termino) ||
            (producto.codigoBarras ?? "").includes(termino)),
      )
      .slice(0, 12);
  }, [productos, busqueda]);

  async function confirmarVenta() {
    setError(null);

    if (carritoActivo.items.length === 0) {
      setError("Todavía no cargaste ningún producto");
      return;
    }

    let pagos: PagoCarrito[] = [];

    if (carritoActivo.medioPago === "efectivo") {
      const pagaCon = carritoActivo.pagaCon ? Number(carritoActivo.pagaCon) : total;
      if (!Number.isFinite(pagaCon) || pagaCon < total) {
        setError("Con ese monto no alcanza para cubrir el total");
        return;
      }
      pagos = [{ medio: "efectivo", monto: pagaCon, vuelto: calcularVuelto(pagaCon, total) }];
    } else if (carritoActivo.medioPago === "mixto") {
      const efectivo = Number(carritoActivo.montoMixtoEfectivo) || 0;
      if (efectivo <= 0 || efectivo >= total) {
        setError("En pago mixto, la parte en efectivo tiene que ser mayor a cero y menor al total");
        return;
      }
      pagos = [
        { medio: "efectivo", monto: efectivo, vuelto: 0 },
        { medio: "transferencia", monto: total - efectivo, vuelto: 0 },
      ];
    } else if (carritoActivo.medioPago === "fiado") {
      if (!carritoActivo.clienteId) {
        setError("Para fiar tenés que elegir a qué cliente");
        return;
      }
      if (carritoActivo.clienteId === CLIENTE_NUEVO && !carritoActivo.nombreClienteNuevo.trim()) {
        setError("Escribí el nombre del cliente");
        return;
      }
      pagos = [{ medio: "fiado", monto: total, vuelto: 0 }];
    } else {
      pagos = [{ medio: carritoActivo.medioPago, monto: total, vuelto: 0 }];
    }

    if (!pagosCubrenElTotal(pagos, total)) {
      setError("Los pagos cargados no cubren el total de la venta");
      return;
    }

    setGuardando(true);
    const supabase = crearClienteNavegador();

    // Fiar a un cliente recién decidido en el momento: se crea acá,
    // como parte del mismo gesto de cobrar, en vez de mandar al
    // cajero a /clientes a mitad de una venta.
    let clienteId: string | null = null;
    if (carritoActivo.medioPago === "fiado") {
      if (carritoActivo.clienteId === CLIENTE_NUEVO) {
        const { data: nuevoCliente, error: errorCliente } = await supabase
          .from("clientes")
          .insert({ nombre: carritoActivo.nombreClienteNuevo.trim() })
          .select("id, nombre, telefono, direccion, saldo_cuenta_corriente")
          .single();

        if (errorCliente || !nuevoCliente) {
          setError("No se pudo crear el cliente. Probá de nuevo.");
          setGuardando(false);
          return;
        }

        clienteId = nuevoCliente.id;
        setListaClientes((anteriores) =>
          [
            ...anteriores,
            {
              id: nuevoCliente.id,
              nombre: nuevoCliente.nombre,
              telefono: nuevoCliente.telefono,
              direccion: nuevoCliente.direccion,
              saldoCuentaCorriente: Number(nuevoCliente.saldo_cuenta_corriente),
            },
          ].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
      } else {
        clienteId = carritoActivo.clienteId;
      }
    }

    const { error: errorRpc } = await supabase.rpc("registrar_venta", {
      p_turno_caja_id: turnoCajaId,
      p_cliente_id: clienteId,
      p_items: carritoActivo.items.map((item) => ({
        producto_id: item.productoId,
        cantidad: item.cantidad,
        precio_unitario: item.precioUnitario,
      })),
      p_pagos: pagos,
    });
    setGuardando(false);

    if (errorRpc) {
      setError(errorRpc.message);
      return;
    }

    const medioTexto: Record<MedioPagoUi, string> = {
      efectivo: "Efectivo",
      transferencia: "Transferencia",
      qr: "QR",
      mixto: "Mixto",
      fiado: "Fiado",
    };
    setComprobante({
      items: carritoActivo.items,
      total,
      medioTexto: medioTexto[carritoActivo.medioPago],
      vuelto: pagos.reduce((suma, pago) => suma + pago.vuelto, 0),
    });
    cerrarVenta(carritoActivo.id);
    router.refresh();
  }

  const vuelto =
    carritoActivo.medioPago === "efectivo" && carritoActivo.pagaCon
      ? calcularVuelto(Number(carritoActivo.pagaCon), total)
      : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {carritos.map((carrito, indice) => (
          <div
            key={carrito.id}
            className={`flex items-center gap-1.5 rounded-[var(--radius-base)] border px-2.5 py-1.5 text-sm ${
              carrito.id === carritoActivoId
                ? "border-marco bg-marco text-white"
                : "border-linea bg-superficie text-texto-suave hover:text-texto"
            }`}
          >
            <button type="button" onClick={() => setCarritoActivoId(carrito.id)}>
              Venta {indice + 1}
              {carrito.items.length > 0 && ` (${carrito.items.length})`}
            </button>
            {carritos.length > 1 && (
              <button
                type="button"
                aria-label={`Cerrar venta ${indice + 1}`}
                onClick={() => cerrarVenta(carrito.id)}
                className="opacity-70 hover:opacity-100"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <Boton type="button" variante="fantasma" className="px-2.5 py-1.5 text-sm" onClick={nuevaVenta}>
          + Nueva venta
        </Boton>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          <form onSubmit={leerCodigo} className="rounded-[var(--radius-base)] bg-marco p-4">
            <div className="flex gap-2">
              <input
                autoFocus
                autoComplete="off"
                value={codigoLector}
                onChange={(evento) => setCodigoLector(evento.target.value)}
                placeholder="Escaneá o escribí el código de barras"
                className="flex-1 rounded-[var(--radius-base)] border border-white/20 bg-marco-suave px-3 py-3 font-[family-name:var(--font-numero)] text-base text-white placeholder:text-white/40 outline-none"
              />
              <Boton type="submit">Agregar</Boton>
            </div>
          </form>

          <input
            className={clasesFiltro}
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
          />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {productosFiltrados.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-texto-suave">
                No hay productos con ese nombre.
              </p>
            ) : (
              productosFiltrados.map((producto) => {
                const sinStock = producto.stockActual <= 0;
                return (
                  <button
                    key={producto.id}
                    type="button"
                    disabled={sinStock}
                    onClick={() => agregarProducto(producto)}
                    className={`rounded-[var(--radius-base)] border border-linea bg-superficie p-3 text-left transition hover:border-marco disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <p className="text-sm font-semibold text-texto">{producto.nombre}</p>
                    <p className="numero mt-1.5 text-sm font-semibold text-texto">
                      {platita.format(producto.precioVenta)}
                    </p>
                    <p className="numero mt-0.5 text-xs text-texto-suave">
                      {sinStock ? "sin stock" : `${producto.stockActual} en góndola`}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-[var(--radius-base)] border border-linea bg-superficie">
            <div className="flex items-center justify-between border-b border-linea px-4 py-3">
              <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold text-texto">
                Venta en curso
              </h3>
              {carritoActivo.items.length > 0 && (
                <button
                  type="button"
                  className="text-xs text-texto-suave underline"
                  onClick={() => actualizarCarritoActivo({ items: [] })}
                >
                  Vaciar
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {carritoActivo.items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-texto-suave">
                  Escaneá el primer producto para empezar.
                </p>
              ) : (
                carritoActivo.items.map((item) => (
                  <FilaCarritoItem
                    key={item.productoId}
                    item={item}
                    producto={productos.find((producto) => producto.id === item.productoId)}
                    onCambiarPaso={(delta) => cambiarCantidad(item.productoId, delta)}
                    onCambiarCantidadExacta={(cantidad) => cambiarCantidadExacta(item.productoId, cantidad)}
                    onQuitar={() => quitarProducto(item.productoId)}
                  />
                ))
              )}
            </div>
            <div className="flex items-baseline justify-between bg-marco px-4 py-3">
              <span className="font-[family-name:var(--font-numero)] text-xs tracking-wider text-white/60">
                TOTAL
              </span>
              <span className="numero text-2xl font-semibold text-acento">{platita.format(total)}</span>
            </div>
          </div>

          <div className="rounded-[var(--radius-base)] border border-linea bg-superficie p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-texto-suave">Cómo paga</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["efectivo", "Efectivo"],
                  ["transferencia", "Transferencia"],
                  ["qr", "QR"],
                  ["mixto", "Mixto"],
                  ["fiado", "Fiado"],
                ] as [MedioPagoUi, string][]
              ).map(([medio, etiqueta]) => (
                <button
                  key={medio}
                  type="button"
                  onClick={() => actualizarCarritoActivo({ medioPago: medio })}
                  className={`rounded-[var(--radius-base)] border px-2 py-2 text-xs font-semibold ${
                    carritoActivo.medioPago === medio
                      ? "border-marco bg-marco text-white"
                      : "border-linea bg-superficie text-texto hover:border-marco"
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            <div className="mt-3">
              {carritoActivo.medioPago === "efectivo" && (
                <>
                  <label htmlFor="pagaCon" className="mb-1 block text-xs text-texto-suave">
                    ¿Con cuánto paga?
                  </label>
                  <input
                    id="pagaCon"
                    type="number"
                    min={0}
                    step="1"
                    placeholder={String(total)}
                    value={carritoActivo.pagaCon}
                    onChange={(evento) => actualizarCarritoActivo({ pagaCon: evento.target.value })}
                    onFocus={(evento) => evento.currentTarget.select()}
                    className={`${clasesFiltro} numero w-full`}
                  />
                  {carritoActivo.pagaCon && vuelto >= 0 && Number(carritoActivo.pagaCon) >= total && (
                    <div className="mt-2 flex items-center justify-between rounded-[var(--radius-base)] bg-ok-fondo px-3 py-2">
                      <span className="text-xs font-semibold text-ok">Vuelto</span>
                      <span className="numero text-sm font-semibold text-ok">{platita.format(vuelto)}</span>
                    </div>
                  )}
                </>
              )}

              {carritoActivo.medioPago === "mixto" && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="montoMixto" className="text-xs text-texto-suave">
                    Monto en efectivo (el resto va por transferencia)
                  </label>
                  <input
                    id="montoMixto"
                    type="number"
                    min={0}
                    step="1"
                    value={carritoActivo.montoMixtoEfectivo}
                    onChange={(evento) => actualizarCarritoActivo({ montoMixtoEfectivo: evento.target.value })}
                    onFocus={(evento) => evento.currentTarget.select()}
                    className={`${clasesFiltro} numero w-full`}
                  />
                </div>
              )}

              {carritoActivo.medioPago === "fiado" && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="clienteFiado" className="text-xs text-texto-suave">
                      ¿A quién se le fía?
                    </label>
                    <select
                      id="clienteFiado"
                      className={clasesSelect}
                      value={carritoActivo.clienteId}
                      onChange={(evento) => actualizarCarritoActivo({ clienteId: evento.target.value })}
                    >
                      <option value="">Elegir cliente</option>
                      {listaClientes.map((cliente) => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nombre}
                          {cliente.saldoCuentaCorriente > 0
                            ? ` — debe ${platita.format(cliente.saldoCuentaCorriente)}`
                            : ""}
                        </option>
                      ))}
                      <option value={CLIENTE_NUEVO}>+ Nuevo cliente…</option>
                    </select>
                  </div>

                  {carritoActivo.clienteId === CLIENTE_NUEVO && (
                    <Campo
                      etiqueta="Nombre del cliente nuevo"
                      id="nombreClienteNuevo"
                      value={carritoActivo.nombreClienteNuevo}
                      onChange={(evento) =>
                        actualizarCarritoActivo({ nombreClienteNuevo: evento.target.value })
                      }
                    />
                  )}
                </div>
              )}
            </div>

            {error && (
              <p className="mt-3 rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">
                {error}
              </p>
            )}

            <Boton
              type="button"
              variante="confirmar"
              className="mt-3 w-full"
              disabled={carritoActivo.items.length === 0 || guardando}
              onClick={confirmarVenta}
            >
              {guardando ? "Cobrando…" : `Cobrar ${platita.format(total)}`}
            </Boton>
          </div>
        </div>
      </div>

      <Modal titulo="Venta registrada" abierto={comprobante !== null} onCerrar={() => setComprobante(null)}>
        {comprobante && (
          <div className="flex flex-col gap-3">
            <div className="rounded-[var(--radius-base)] bg-fondo p-4 font-[family-name:var(--font-numero)] text-xs leading-relaxed">
              {comprobante.items.map((item) => (
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
                <span>{platita.format(comprobante.total)}</span>
              </div>
              <div className="flex justify-between text-texto-suave">
                <span>{comprobante.medioTexto}</span>
                {comprobante.vuelto > 0 && <span>Vuelto {platita.format(comprobante.vuelto)}</span>}
              </div>
              <p className="mt-2 text-center text-[10px] text-texto-suave">Documento no válido como factura</p>
            </div>
            <Boton type="button" variante="confirmar" onClick={() => setComprobante(null)}>
              Seguir vendiendo
            </Boton>
          </div>
        )}
      </Modal>
    </div>
  );
}
