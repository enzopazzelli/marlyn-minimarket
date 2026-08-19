"use client";

import { useState, type FormEvent } from "react";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import { restablecerContraseña } from "../consultas/acciones";

// No hay infraestructura de email en el proyecto (ver README) para un
// "olvidé mi contraseña" con link — el dueño la resetea a mano acá y se
// la vuelve a pasar. No hace falta router.refresh(): no cambia nada que
// se vea en la tabla de usuarios.
export function BotonRestablecerContraseña({ usuarioId, nombre }: { usuarioId: string; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  function abrir() {
    setPassword("");
    setError(null);
    setListo(false);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

  async function alGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña tiene que tener al menos 6 caracteres");
      return;
    }

    setGuardando(true);
    try {
      await restablecerContraseña(usuarioId, password);
      setListo(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo cambiar la contraseña. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="text-xs text-texto-suave underline decoration-dotted underline-offset-2 hover:text-texto"
      >
        Restablecer contraseña
      </button>

      <Modal titulo={`Restablecer contraseña — ${nombre}`} abierto={abierto} onCerrar={cerrar}>
        {listo ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-[var(--radius-base)] bg-ok-fondo px-3 py-2 text-sm text-ok">
              Contraseña cambiada. Pasásela a {nombre} — la anterior dejó de funcionar.
            </p>
            <div className="flex justify-end">
              <Boton type="button" onClick={cerrar}>
                Listo
              </Boton>
            </div>
          </div>
        ) : (
          <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
            <Campo
              etiqueta="Contraseña nueva"
              id={`passwordNuevo-${usuarioId}`}
              type="text"
              autoComplete="off"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              className="font-[family-name:var(--font-numero)]"
              autoFocus
            />

            {error && (
              <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
            )}

            <div className="mt-2 flex justify-end gap-2">
              <Boton type="button" variante="fantasma" onClick={cerrar}>
                Cancelar
              </Boton>
              <Boton type="submit" variante="confirmar" disabled={guardando}>
                {guardando ? "Cambiando…" : "Cambiar contraseña"}
              </Boton>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
