"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { coincideBusqueda } from "@/lib/busqueda";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { CampoPrecio } from "@/componentes/CampoPrecio";
import { Modal } from "@/componentes/Modal";
import { contieneCodigo } from "@/modulos/stock/consultas/codigosBarras";
import type { Producto } from "@/modulos/stock/tipos";
import type { PromocionAdmin } from "../consultas/promociones";
import type { TipoPromocion } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const ETIQUETA_TIPO: Record<TipoPromocion, string> = {
  cantidad: "Descuento por cantidad",
  combo: "Combo de productos",
};

type ItemForm = { productoId: string; nombreProducto: string; precioVenta: number; cantidad: string };

function estadoInicial(promocionExistente?: PromocionAdmin) {
  if (promocionExistente) {
    return {
      nombre: promocionExistente.nombre,
      tipo: promocionExistente.tipo,
      precioPromocional: String(promocionExistente.precioPromocional),
      items: promocionExistente.items.map((item) => ({
        productoId: item.productoId,
        nombreProducto: item.nombreProducto,
        precioVenta: item.precioVenta,
        cantidad: String(item.cantidad),
      })),
    };
  }
  return {
    nombre: "",
    tipo: "cantidad" as TipoPromocion,
    precioPromocional: "",
    items: [] as ItemForm[],
  };
}

// Alta/edición en un solo formulario. El tipo (cantidad/combo) solo se
// elige en el alta: cambiarlo en una promo ya guardada cambiaría el
// significado de los items existentes (umbral de paquete vs. cantidad
// dentro de un combo) — más simple borrar y crear de nuevo si hace
// falta cambiarlo.
export function FormularioPromocion({
  productos,
  promocionExistente,
  abierto,
  onCerrar,
}: {
  productos: Producto[];
  promocionExistente?: PromocionAdmin;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [campos, setCampos] = useState(() => estadoInicial(promocionExistente));
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "Adjusting state when a prop changes" (react.dev): reabrir el modal
  // (nueva promo, o "Editar" de otra fila) tiene que reiniciar el
  // formulario — "abierto"/"promocionExistente" es lo que cambia.
  const [abiertoVisto, setAbiertoVisto] = useState(abierto);
  if (abierto !== abiertoVisto) {
    setAbiertoVisto(abierto);
    if (abierto) {
      setCampos(estadoInicial(promocionExistente));
      setBusqueda("");
      setError(null);
    }
  }

  const esCombo = campos.tipo === "combo";
  const limiteProductos = esCombo ? Infinity : 1;

  const coincidencias = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return [];
    const yaElegidos = new Set(campos.items.map((item) => item.productoId));
    return productos
      .filter(
        (producto) =>
          producto.activo &&
          !yaElegidos.has(producto.id) &&
          (coincideBusqueda(producto.nombre, busqueda) || contieneCodigo(producto, termino)),
      )
      .slice(0, 6);
  }, [productos, busqueda, campos.items]);

  function elegirProducto(producto: Producto) {
    setCampos((anteriores) => {
      const nuevoItem: ItemForm = {
        productoId: producto.id,
        nombreProducto: producto.nombre,
        precioVenta: producto.precioVenta,
        cantidad: "1",
      };
      return { ...anteriores, items: [...anteriores.items, nuevoItem] };
    });
    setBusqueda("");
  }

  function quitarProducto(productoId: string) {
    setCampos((anteriores) => ({
      ...anteriores,
      items: anteriores.items.filter((item) => item.productoId !== productoId),
    }));
  }

  function cambiarCantidadItem(productoId: string, cantidad: string) {
    setCampos((anteriores) => ({
      ...anteriores,
      items: anteriores.items.map((item) => (item.productoId === productoId ? { ...item, cantidad } : item)),
    }));
  }

  const normalTotal = campos.items.reduce(
    (acumulado, item) => acumulado + item.precioVenta * (Number(item.cantidad) || 0),
    0,
  );
  const precioPromoNumero = Number(campos.precioPromocional) || 0;
  const diferencia = normalTotal - precioPromoNumero;
  const mostrarPreview = campos.items.length > 0 && precioPromoNumero > 0;

  async function alGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (!campos.nombre.trim()) {
      setError("Escribí un nombre para la promoción");
      return;
    }
    if (campos.tipo === "cantidad" && campos.items.length !== 1) {
      setError("Elegí el producto de la promoción");
      return;
    }
    if (campos.tipo === "combo" && campos.items.length < 2) {
      setError("Un combo necesita al menos dos productos distintos");
      return;
    }
    if (!precioPromoNumero || precioPromoNumero <= 0) {
      setError("El precio de la promoción tiene que ser mayor a cero");
      return;
    }
    for (const item of campos.items) {
      if (!Number(item.cantidad) || Number(item.cantidad) <= 0) {
        setError(`La cantidad de "${item.nombreProducto}" tiene que ser mayor a cero`);
        return;
      }
    }

    setGuardando(true);
    const supabase = crearClienteNavegador();

    const { error: errorRpc } = await supabase.rpc("guardar_promocion", {
      p_id: promocionExistente?.id ?? null,
      p_nombre: campos.nombre.trim(),
      p_tipo: campos.tipo,
      p_precio_promocional: precioPromoNumero,
      p_activa: promocionExistente?.activa ?? true,
      p_items: campos.items.map((item) => ({ producto_id: item.productoId, cantidad: Number(item.cantidad) })),
    });

    setGuardando(false);

    if (errorRpc) {
      setError(errorRpc.message);
      return;
    }

    router.refresh();
    onCerrar();
  }

  return (
    <Modal
      titulo={promocionExistente ? "Editar promoción" : "Nueva promoción"}
      abierto={abierto}
      onCerrar={onCerrar}
    >
      <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
        <Campo
          etiqueta="Nombre"
          id="nombrePromocion"
          placeholder="Ej: 3 Alka x $100"
          value={campos.nombre}
          onChange={(evento) => setCampos({ ...campos, nombre: evento.target.value })}
        />

        {promocionExistente ? (
          <p className="text-xs text-texto-suave">Tipo: {ETIQUETA_TIPO[campos.tipo]}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Boton
              type="button"
              variante={campos.tipo === "cantidad" ? "confirmar" : "fantasma"}
              onClick={() => setCampos({ ...campos, tipo: "cantidad", items: campos.items.slice(0, 1) })}
            >
              Descuento por cantidad
            </Boton>
            <Boton
              type="button"
              variante={campos.tipo === "combo" ? "confirmar" : "fantasma"}
              onClick={() => setCampos({ ...campos, tipo: "combo" })}
            >
              Combo de productos
            </Boton>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm text-texto-suave">{esCombo ? "Productos del combo" : "Producto"}</p>

          {campos.items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {campos.items.map((item) => (
                <li
                  key={item.productoId}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-2"
                >
                  <span className="text-sm text-texto">{item.nombreProducto}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      step="1"
                      aria-label={`Cantidad de ${item.nombreProducto}`}
                      value={item.cantidad}
                      onChange={(evento) => cambiarCantidadItem(item.productoId, evento.target.value)}
                      onFocus={(evento) => evento.currentTarget.select()}
                      className="numero w-16 rounded border border-linea px-2 py-1 text-right text-sm outline-none focus-visible:border-acento"
                    />
                    <button
                      type="button"
                      onClick={() => quitarProducto(item.productoId)}
                      aria-label={`Quitar ${item.nombreProducto}`}
                      className="text-texto-suave hover:text-alerta"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {campos.items.length < limiteProductos && (
            <div>
              <Campo
                etiqueta="Buscar producto"
                id="buscarProductoPromo"
                placeholder="Nombre o código de barras..."
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                autoComplete="off"
              />
              {busqueda.trim() && (
                <div className="mt-1 flex flex-col divide-y divide-linea rounded-[var(--radius-base)] border border-linea">
                  {coincidencias.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-texto-suave">Sin resultados.</p>
                  ) : (
                    coincidencias.map((producto) => (
                      <button
                        key={producto.id}
                        type="button"
                        onClick={() => elegirProducto(producto)}
                        className="flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-fondo"
                      >
                        <span className="text-texto">{producto.nombre}</span>
                        <span className="numero text-xs text-texto-suave">
                          {platita.format(producto.precioVenta)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <CampoPrecio
          etiqueta={esCombo ? "Precio del combo" : "Precio del paquete"}
          id="precioPromocional"
          value={campos.precioPromocional}
          onChange={(valor) => setCampos({ ...campos, precioPromocional: valor })}
        />

        {mostrarPreview && (
          <div className="rounded-[var(--radius-base)] bg-fondo px-3 py-2 text-sm">
            <p className="text-texto-suave">
              Normal: <span className="numero text-texto">{platita.format(normalTotal)}</span> → Promo:{" "}
              <span className="numero font-semibold text-texto">{platita.format(precioPromoNumero)}</span>
            </p>
            <p className={`numero font-semibold ${diferencia >= 0 ? "text-ok" : "text-alerta"}`}>
              {diferencia >= 0 ? `Ahorro: ${platita.format(diferencia)}` : `Recargo: ${platita.format(-diferencia)}`}
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" variante="confirmar" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar promoción"}
          </Boton>
        </div>
      </form>
    </Modal>
  );
}
