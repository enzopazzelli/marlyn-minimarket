"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import type { Producto } from "../tipos";

type Tipo = "entrada" | "salida";

function pasoDeStock(unidad: "unidad" | "kg" | "litro") {
  return unidad === "unidad" ? "1" : "0.1";
}

// Reemplaza al viejo "ingresar mercadería" (solo sumaba): un mismo
// modal con toggle Entrada/Salida en vez de pedir un número con signo
// — el signo lo decide el toggle, nunca hay que tipear un "-" (en
// pantallas táctiles el teclado numérico con min=0 ni lo muestra).
//
// Pedido del dueño (2026-09-07): solo cantidad, nada más. Antes tenía
// motivo (obligatorio en salida) y precio de venta (solo dueño, en
// entrada) — los dos se sacaron a pedido explícito. El motivo queda
// igual registrado en movimientos_stock con un texto genérico
// ("Ajuste de stock" / "Ingreso de mercadería"): eso lo resuelve
// registrar_ajuste_stock() solo (ver migración 20260907100000), acá no
// hace falta mandar nada. El precio de venta se sigue pudiendo tocar
// desde "Editar" si hace falta.
export function FormularioAjusteStock({ producto }: { producto: Producto }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setTipo("entrada");
    setCantidad("");
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

    if (tipo === "salida" && cantidadNumero > producto.stockActual) {
      setError(`Solo hay ${producto.stockActual} en góndola`);
      return;
    }

    setGuardando(true);
    const supabase = crearClienteNavegador();

    try {
      const { error: errorRpc } = await supabase.rpc("registrar_ajuste_stock", {
        p_producto_id: producto.id,
        p_cantidad: cantidadNumero,
        p_tipo: tipo,
      });

      if (errorRpc) {
        setError(
          /stock suficiente/i.test(errorRpc.message)
            ? `Solo hay ${producto.stockActual} en góndola`
            : "No se pudo registrar el ajuste. Probá de nuevo.",
        );
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
        Ajustar stock
      </button>

      <Modal titulo={`Ajustar stock — ${producto.nombre}`} abierto={abierto} onCerrar={cerrar}>
        <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
          <p className="text-sm text-texto-suave">
            Hay <span className="numero font-semibold text-texto">{producto.stockActual}</span> en góndola.
          </p>

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
            id={`cantidad-${producto.id}`}
            type="number"
            min={0}
            step={pasoDeStock(producto.unidad)}
            value={cantidad}
            onChange={(evento) => setCantidad(evento.target.value)}
            autoFocus
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
