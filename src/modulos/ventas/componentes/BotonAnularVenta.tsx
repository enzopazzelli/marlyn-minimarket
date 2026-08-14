"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import { crearClienteNavegador } from "@/lib/supabase/cliente";

// Solo se usa desde ListaVentasDelTurno.tsx, que ya viene filtrada al
// turno abierto — anular_venta() (en la base) devuelve el stock,
// revierte el fiado si lo hubo y, desde la migración
// 20260814120000, descuenta de movimientos_caja la parte que se cobró
// en efectivo, para que el arqueo de este turno siga siendo correcto.
// Motivo obligatorio, mismo criterio que FormularioMovimientoCaja.tsx.
export function BotonAnularVenta({ ventaId, numero }: { ventaId: string; numero: number }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setMotivo("");
    setError(null);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

  async function confirmar() {
    if (!motivo.trim()) {
      setError("Escribí por qué se anula");
      return;
    }

    setError(null);
    setGuardando(true);
    const supabase = crearClienteNavegador();
    const { error: errorRpc } = await supabase.rpc("anular_venta", {
      p_venta_id: ventaId,
      p_motivo: motivo.trim(),
    });
    setGuardando(false);

    if (errorRpc) {
      setError(errorRpc.message);
      return;
    }

    setAbierto(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="text-xs text-texto-suave underline decoration-dotted underline-offset-2 hover:text-alerta"
      >
        Anular
      </button>

      <Modal titulo={`Anular venta #${numero}`} abierto={abierto} onCerrar={cerrar}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-texto-suave">
            Devuelve el stock vendido y revierte el fiado si lo hubo. Si se cobró en efectivo, descuenta ese
            monto de la caja de este turno. No se puede deshacer.
          </p>

          <Campo
            etiqueta="Motivo"
            id="motivoAnulacion"
            placeholder="Ej: producto equivocado, cliente se arrepintió…"
            value={motivo}
            onChange={(evento) => setMotivo(evento.target.value)}
          />

          {error && (
            <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={cerrar}>
              Volver
            </Boton>
            <Boton type="button" variante="peligro" disabled={guardando} onClick={confirmar}>
              {guardando ? "Anulando…" : "Anular venta"}
            </Boton>
          </div>
        </div>
      </Modal>
    </>
  );
}
