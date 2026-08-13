"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import {
  listarMovimientosCuentaCorriente,
  type MovimientoCuentaCorrienteDetallado,
} from "../consultas/clientes";
import type { Cliente } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const fechaFormateador = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" });

const etiquetaTipo: Record<MovimientoCuentaCorrienteDetallado["tipo"], string> = {
  fiado: "Fiado",
  pago: "Pago",
  recargo: "Recargo",
};

export function PanelCuentaCorriente({
  cliente,
  turnoCajaId,
}: {
  cliente: Cliente;
  turnoCajaId: string | null;
}) {
  const router = useRouter();
  // Saldo llevado en estado local, no leído directo de `cliente` en
  // cada render: aplicar recargo y registrar pago son dos acciones que
  // pueden pasar una atrás de la otra dentro del mismo modal, y
  // `cliente.saldoCuentaCorriente` no se actualiza hasta que
  // router.refresh() termina la vuelta completa al servidor. Sin este
  // estado propio, "cobrar" justo después de "aplicar recargo" validaría
  // contra el saldo viejo. Mismo patrón de "adjusting state when a prop
  // changes" que ya se usa para categorías/proveedores.
  const [saldoVisto, setSaldoVisto] = useState(cliente.saldoCuentaCorriente);
  const [saldoActual, setSaldoActual] = useState(cliente.saldoCuentaCorriente);
  if (cliente.saldoCuentaCorriente !== saldoVisto) {
    setSaldoVisto(cliente.saldoCuentaCorriente);
    setSaldoActual(cliente.saldoCuentaCorriente);
  }

  const [abierto, setAbierto] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoCuentaCorrienteDetallado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [porcentajeRecargo, setPorcentajeRecargo] = useState("0");
  const [montoPago, setMontoPago] = useState("");
  const [medioPago, setMedioPago] = useState<"efectivo" | "transferencia">("efectivo");
  const [ocupado, setOcupado] = useState<"recargo" | "pago" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargarMovimientos() {
    setCargando(true);
    const supabase = crearClienteNavegador();
    try {
      const datos = await listarMovimientosCuentaCorriente(supabase, cliente.id);
      setMovimientos(datos);
    } catch {
      setError("No se pudo cargar el historial. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  function abrir() {
    setSaldoActual(cliente.saldoCuentaCorriente);
    setPorcentajeRecargo("0");
    setMontoPago(cliente.saldoCuentaCorriente > 0 ? String(cliente.saldoCuentaCorriente) : "");
    setMedioPago("efectivo");
    setError(null);
    setAbierto(true);
    cargarMovimientos();
  }

  function cerrar() {
    setAbierto(false);
  }

  async function aplicarRecargo() {
    setError(null);
    const porcentaje = Number(porcentajeRecargo);
    if (!Number.isFinite(porcentaje) || porcentaje <= 0) {
      setError("El % de recargo tiene que ser mayor a cero");
      return;
    }

    const monto = Math.round(saldoActual * (porcentaje / 100) * 100) / 100;
    if (monto <= 0) {
      setError("No hay saldo sobre el que aplicar recargo");
      return;
    }

    setOcupado("recargo");
    const supabase = crearClienteNavegador();
    const { error: errorRpc } = await supabase.rpc("registrar_movimiento_cuenta_corriente", {
      p_cliente_id: cliente.id,
      p_tipo: "recargo",
      p_monto: monto,
      p_nota: `Recargo ${porcentaje}%`,
    });
    setOcupado(null);

    if (errorRpc) {
      setError("No se pudo aplicar el recargo. Probá de nuevo.");
      return;
    }

    // Actualizado a mano (no esperar a router.refresh()): "cobrar" puede
    // pasar en el mismo gesto, justo después, y tiene que validar contra
    // el saldo ya con el recargo, no el viejo.
    const nuevoSaldo = saldoActual + monto;
    setSaldoActual(nuevoSaldo);
    setPorcentajeRecargo("0");
    setMontoPago(String(nuevoSaldo));
    await cargarMovimientos();
    router.refresh();
  }

  async function registrarPago() {
    setError(null);
    const monto = Number(montoPago);
    if (!Number.isFinite(monto) || monto <= 0) {
      setError("Poné un monto mayor a cero");
      return;
    }
    if (monto > saldoActual) {
      setError("El pago no puede ser mayor a lo que debe");
      return;
    }
    if (medioPago === "efectivo" && !turnoCajaId) {
      setError("Necesitás la caja abierta para cobrar en efectivo");
      return;
    }

    setOcupado("pago");
    const supabase = crearClienteNavegador();
    const { error: errorRpc } = await supabase.rpc("registrar_movimiento_cuenta_corriente", {
      p_cliente_id: cliente.id,
      p_tipo: "pago",
      p_monto: monto,
      p_medio: medioPago,
      p_turno_caja_id: medioPago === "efectivo" ? turnoCajaId : null,
    });
    setOcupado(null);

    if (errorRpc) {
      setError("No se pudo registrar el pago. Probá de nuevo.");
      return;
    }

    setSaldoActual((anterior) => anterior - monto);
    setMontoPago("");
    await cargarMovimientos();
    router.refresh();
  }

  const totalConRecargo = (() => {
    const porcentaje = Number(porcentajeRecargo);
    if (!Number.isFinite(porcentaje) || porcentaje <= 0) return null;
    return saldoActual * (1 + porcentaje / 100);
  })();

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="text-xs font-medium text-texto-suave underline decoration-dotted underline-offset-2 hover:text-texto"
      >
        Ver cuenta
      </button>

      <Modal titulo={`Cuenta de ${cliente.nombre}`} abierto={abierto} onCerrar={cerrar}>
        <div className="flex flex-col gap-4">
          <div className="rounded-[var(--radius-base)] bg-fondo px-4 py-3">
            <p className="text-xs text-texto-suave">Debe</p>
            <p className={`numero text-xl font-semibold ${saldoActual > 0 ? "text-alerta" : "text-ok"}`}>
              {saldoActual > 0 ? platita.format(saldoActual) : "Al día"}
            </p>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-[var(--radius-base)] border border-linea">
            {cargando ? (
              <p className="px-3 py-6 text-center text-sm text-texto-suave">Cargando…</p>
            ) : movimientos.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-texto-suave">Sin movimientos todavía.</p>
            ) : (
              <ul className="divide-y divide-linea">
                {movimientos.map((movimiento) => (
                  <li key={movimiento.id} className="px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-texto-suave">
                        <span className="numero">{fechaFormateador.format(new Date(movimiento.creadoEn))}</span>{" "}
                        · {etiquetaTipo[movimiento.tipo]}
                        {movimiento.nota ? ` (${movimiento.nota})` : ""}
                      </span>
                      <span
                        className={`numero font-semibold ${movimiento.tipo === "pago" ? "text-ok" : "text-alerta"}`}
                      >
                        {movimiento.tipo === "pago" ? "−" : "+"}
                        {platita.format(movimiento.monto)}
                      </span>
                    </div>
                    {movimiento.items.length > 0 && (
                      <ul className="mt-1 pl-4 text-xs text-texto-suave">
                        {movimiento.items.map((item, indice) => (
                          <li key={indice}>
                            {item.cantidad} × {item.nombre}
                            {item.eliminado && " [Eliminado]"} — {platita.format(item.precioUnitario)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-[var(--radius-base)] border border-linea p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">
              Aplicar recargo por atraso
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Campo
                  etiqueta="% de recargo"
                  id="porcentajeRecargo"
                  type="number"
                  min={0}
                  step="1"
                  value={porcentajeRecargo}
                  onChange={(evento) => setPorcentajeRecargo(evento.target.value)}
                  className="font-[family-name:var(--font-numero)]"
                />
              </div>
              <Boton type="button" variante="fantasma" disabled={ocupado !== null} onClick={aplicarRecargo}>
                Aplicar
              </Boton>
            </div>
            {totalConRecargo !== null && (
              <p className="text-xs text-texto-suave">
                Con recargo pasaría a deber <span className="numero font-semibold">{platita.format(totalConRecargo)}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-[var(--radius-base)] border border-linea p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">Registrar pago</p>
            <div className="flex gap-1.5">
              {(["efectivo", "transferencia"] as const).map((medio) => (
                <button
                  key={medio}
                  type="button"
                  onClick={() => setMedioPago(medio)}
                  className={`flex-1 rounded-[var(--radius-base)] border px-2 py-1.5 text-xs font-semibold capitalize ${
                    medioPago === medio
                      ? "border-marco bg-marco text-white"
                      : "border-linea bg-superficie text-texto hover:border-marco"
                  }`}
                >
                  {medio}
                </button>
              ))}
            </div>
            {medioPago === "efectivo" && !turnoCajaId && (
              <p className="text-xs text-alerta">Necesitás la caja abierta para cobrar en efectivo.</p>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Campo
                  etiqueta="Monto"
                  id="montoPago"
                  type="number"
                  min={0}
                  step="1"
                  value={montoPago}
                  onChange={(evento) => setMontoPago(evento.target.value)}
                  className="font-[family-name:var(--font-numero)]"
                />
              </div>
              <Boton
                type="button"
                variante="confirmar"
                disabled={ocupado !== null || (medioPago === "efectivo" && !turnoCajaId)}
                onClick={registrarPago}
              >
                Cobrar
              </Boton>
            </div>
          </div>

          {error && (
            <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
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
