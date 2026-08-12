"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import type { Producto } from "../tipos";

function pasoDeStock(unidad: "unidad" | "kg" | "litro") {
  return unidad === "unidad" ? "1" : "0.1";
}

export function FormularioIngresoMercaderia({ producto }: { producto: Producto }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cantidad, setCantidad] = useState("");
  const [precioVenta, setPrecioVenta] = useState(String(producto.precioVenta));
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setCantidad("");
    setPrecioVenta(String(producto.precioVenta));
    setMotivo("");
    setError(null);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

  async function alGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const cantidadNumero = Number(cantidad);
    if (!cantidad || !Number.isFinite(cantidadNumero) || cantidadNumero <= 0) {
      setError("La cantidad tiene que ser mayor a cero");
      return;
    }

    const precioNumero = Number(precioVenta);
    if (!Number.isFinite(precioNumero) || precioNumero < 0) {
      setError("El precio de venta tiene que ser mayor o igual a cero");
      return;
    }

    setGuardando(true);
    const supabase = crearClienteNavegador();

    try {
      const { error: errorRpc } = await supabase.rpc("registrar_ingreso_stock", {
        p_producto_id: producto.id,
        p_cantidad: cantidadNumero,
        p_precio_venta_nuevo: precioNumero,
        p_motivo: motivo.trim() || "Ingreso de mercadería",
      });

      if (errorRpc) {
        setError("No se pudo registrar el ingreso. Probá de nuevo.");
        return;
      }

      setAbierto(false);
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="text-xs font-medium text-texto-suave underline decoration-dotted underline-offset-2 hover:text-texto"
      >
        Ingresar
      </button>

      <Modal titulo={`Ingresar mercadería — ${producto.nombre}`} abierto={abierto} onCerrar={cerrar}>
        <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
          <p className="text-sm text-texto-suave">
            Hay <span className="numero font-semibold text-texto">{producto.stockActual}</span> en góndola.
          </p>

          <div className="flex flex-col gap-1.5">
            <Campo
              etiqueta="¿Cuántas unidades entraron?"
              id={`cantidad-${producto.id}`}
              type="number"
              min={0}
              step={pasoDeStock(producto.unidad)}
              value={cantidad}
              onChange={(evento) => setCantidad(evento.target.value)}
              className="font-[family-name:var(--font-numero)]"
              autoFocus
            />
          </div>

          <Campo
            etiqueta="Precio de venta"
            id={`precioVentaIngreso-${producto.id}`}
            type="number"
            min={0}
            step="1"
            value={precioVenta}
            onChange={(evento) => setPrecioVenta(evento.target.value)}
            className="font-[family-name:var(--font-numero)]"
          />

          <Campo
            etiqueta="Motivo (opcional)"
            id={`motivo-${producto.id}`}
            placeholder="Ej: compra a proveedor"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />

          {error && (
            <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">
              {error}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="confirmar" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Boton>
          </div>
        </form>
      </Modal>
    </>
  );
}
