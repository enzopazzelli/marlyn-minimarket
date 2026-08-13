"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { MovimientoCaja } from "../tipos";

// Retiro/ingreso manual de caja (plata que sale o entra sin ser una
// venta — pagarle en efectivo a un repartidor, poner plata propia,
// etc.). Insert directo a movimientos_caja, mismo criterio que
// FormularioAbrirCaja.tsx: una sola tabla, sin invariante que proteger
// más allá de los checks de la columna (monto > 0, tipo válido).
export function FormularioMovimientoCaja({ turnoId }: { turnoId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<MovimientoCaja["tipo"]>("egreso");
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setTipo("egreso");
    setMonto("");
    setMotivo("");
    setError(null);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

  async function registrar() {
    setError(null);
    const montoNumero = Number(monto);
    if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
      setError("El monto tiene que ser mayor a cero");
      return;
    }
    if (!motivo.trim()) {
      setError("Escribí para qué es este movimiento");
      return;
    }

    setGuardando(true);
    const supabase = crearClienteNavegador();
    const { error: errorInsert } = await supabase
      .from("movimientos_caja")
      .insert({ turno_id: turnoId, tipo, monto: montoNumero, motivo: motivo.trim() });
    setGuardando(false);

    if (errorInsert) {
      setError("No se pudo registrar el movimiento. Probá de nuevo.");
      return;
    }

    setAbierto(false);
    router.refresh();
  }

  return (
    <>
      <Boton type="button" variante="fantasma" className="px-2.5 py-1.5 text-xs" onClick={abrir}>
        Registrar movimiento
      </Boton>

      <Modal titulo="Movimiento de caja" abierto={abierto} onCerrar={cerrar}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo("egreso")}
              className={`rounded-[var(--radius-base)] border px-3 py-2 text-sm font-semibold transition ${
                tipo === "egreso"
                  ? "border-alerta bg-alerta text-white"
                  : "border-linea bg-superficie text-texto hover:border-alerta"
              }`}
            >
              Salió plata
            </button>
            <button
              type="button"
              onClick={() => setTipo("ingreso")}
              className={`rounded-[var(--radius-base)] border px-3 py-2 text-sm font-semibold transition ${
                tipo === "ingreso"
                  ? "border-ok bg-ok text-white"
                  : "border-linea bg-superficie text-texto hover:border-ok"
              }`}
            >
              Entró plata
            </button>
          </div>

          <Campo
            etiqueta="Monto"
            id="montoMovimiento"
            type="number"
            min={0}
            step="1"
            value={monto}
            onChange={(evento) => setMonto(evento.target.value)}
            className="numero"
          />

          <Campo
            etiqueta="¿Para qué es?"
            id="motivoMovimiento"
            placeholder="Ej: pago a repartidor, compra de bolsas..."
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />

          {error && (
            <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton type="button" variante="confirmar" disabled={guardando} onClick={registrar}>
              {guardando ? "Guardando…" : "Registrar"}
            </Boton>
          </div>
        </div>
      </Modal>
    </>
  );
}
