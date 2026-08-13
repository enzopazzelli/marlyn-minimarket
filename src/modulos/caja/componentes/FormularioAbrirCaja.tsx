"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";

export function FormularioAbrirCaja({ usuarioId }: { usuarioId: string }) {
  const router = useRouter();
  const [monto, setMonto] = useState("0");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const montoNumero = Number(monto);
    if (!Number.isFinite(montoNumero) || montoNumero < 0) {
      setError("El monto de apertura tiene que ser mayor o igual a cero");
      return;
    }

    setGuardando(true);
    const supabase = crearClienteNavegador();
    const { error: errorInsert } = await supabase
      .from("turnos_caja")
      .insert({ usuario_id: usuarioId, monto_apertura: montoNumero });
    setGuardando(false);

    if (errorInsert) {
      if (errorInsert.code === "23505") {
        setError("Ya tenés una caja abierta.");
      } else {
        setError("No se pudo abrir la caja. Probá de nuevo.");
      }
      return;
    }

    router.refresh();
  }

  return (
    <div className="max-w-sm rounded-[var(--radius-base)] border border-linea bg-superficie p-5">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-base text-texto">Abrir caja</h2>
      <p className="mb-4 text-sm text-texto-suave">
        Anotá cuánto efectivo hay en el cajón antes de empezar a vender.
      </p>
      <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
        <Campo
          etiqueta="Efectivo inicial"
          id="montoApertura"
          type="number"
          min={0}
          step="1"
          value={monto}
          onChange={(evento) => setMonto(evento.target.value)}
          className="font-[family-name:var(--font-numero)]"
        />
        {error && (
          <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
        )}
        <Boton type="submit" variante="confirmar" disabled={guardando}>
          {guardando ? "Abriendo…" : "Abrir caja"}
        </Boton>
      </form>
    </div>
  );
}
