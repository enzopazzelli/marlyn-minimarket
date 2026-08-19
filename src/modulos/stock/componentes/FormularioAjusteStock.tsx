"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { useEsDueño } from "@/lib/supabase/PerfilContext";
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
export function FormularioAjusteStock({ producto }: { producto: Producto }) {
  const esDueño = useEsDueño();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [tipo, setTipo] = useState<Tipo>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [precioVenta, setPrecioVenta] = useState(String(producto.precioVenta));
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setTipo("entrada");
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

    if (tipo === "salida" && cantidadNumero > producto.stockActual) {
      setError(`Solo hay ${producto.stockActual} en góndola`);
      return;
    }

    if (tipo === "salida" && !motivo.trim()) {
      setError("Contá el motivo de la salida (rotura, vencido, corrección de conteo)");
      return;
    }

    // Cambiar el precio de venta acá es solo para dueño (Fase 5 de
    // PLAN-ROLES-AUDITORIA.md) — registrar_ajuste_stock() ya lo
    // ignora igual si no lo sos, esto evita mandar un valor que la
    // base va a pisar de todos modos.
    let precioNumero: number | null = null;
    if (esDueño && tipo === "entrada") {
      precioNumero = Number(precioVenta);
      if (!Number.isFinite(precioNumero) || precioNumero < 0) {
        setError("El precio de venta tiene que ser mayor o igual a cero");
        return;
      }
    }

    setGuardando(true);
    const supabase = crearClienteNavegador();

    try {
      const { error: errorRpc } = await supabase.rpc("registrar_ajuste_stock", {
        p_producto_id: producto.id,
        p_cantidad: cantidadNumero,
        p_tipo: tipo,
        p_precio_venta_nuevo: precioNumero,
        p_motivo: motivo.trim() || null,
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
            className="font-[family-name:var(--font-numero)]"
            autoFocus
          />

          {esDueño && tipo === "entrada" && (
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
          )}

          <Campo
            etiqueta={tipo === "salida" ? "Motivo" : "Motivo (opcional)"}
            id={`motivo-${producto.id}`}
            placeholder={tipo === "entrada" ? "Ej: compra a proveedor" : "Ej: rotura, vencido, conteo físico"}
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
