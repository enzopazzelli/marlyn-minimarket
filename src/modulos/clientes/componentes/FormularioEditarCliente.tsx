"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import type { Cliente } from "../tipos";

// Mismo patrón que FormularioEditarProducto.tsx: precarga desde el
// cliente recibido, update en vez de insert. Resuelve directamente el
// caso que lo pidió: un cliente creado al vuelo desde el TPV
// (PanelVentas, alta rápida al elegir "Fiado") solo tiene nombre — acá
// se completa teléfono/dirección.
function estadoDesdeCliente(cliente: Cliente) {
  return {
    nombre: cliente.nombre,
    telefono: cliente.telefono ?? "",
    direccion: cliente.direccion ?? "",
  };
}

export function FormularioEditarCliente({ cliente }: { cliente: Cliente }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [campos, setCampos] = useState(estadoDesdeCliente(cliente));
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setCampos(estadoDesdeCliente(cliente));
    setError(null);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

  async function alGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (!campos.nombre.trim()) {
      setError("Escribí el nombre del cliente");
      return;
    }

    setGuardando(true);
    const supabase = crearClienteNavegador();
    const { error: errorUpdate } = await supabase
      .from("clientes")
      .update({
        nombre: campos.nombre.trim(),
        telefono: campos.telefono.trim() || null,
        direccion: campos.direccion.trim() || null,
      })
      .eq("id", cliente.id);
    setGuardando(false);

    if (errorUpdate) {
      setError("No se pudo guardar el cliente. Probá de nuevo.");
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
        className="text-xs font-medium text-texto-suave underline decoration-dotted underline-offset-2 hover:text-texto"
      >
        Editar
      </button>

      <Modal titulo={`Editar ${cliente.nombre}`} abierto={abierto} onCerrar={cerrar}>
        <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
          <Campo
            etiqueta="Nombre"
            id={`nombreCliente-${cliente.id}`}
            value={campos.nombre}
            onChange={(evento) => setCampos({ ...campos, nombre: evento.target.value })}
          />
          <Campo
            etiqueta="Teléfono (opcional)"
            id={`telefonoCliente-${cliente.id}`}
            value={campos.telefono}
            onChange={(evento) => setCampos({ ...campos, telefono: evento.target.value })}
            className="font-[family-name:var(--font-numero)]"
          />
          <Campo
            etiqueta="Dirección (opcional)"
            id={`direccionCliente-${cliente.id}`}
            value={campos.direccion}
            onChange={(evento) => setCampos({ ...campos, direccion: evento.target.value })}
          />

          {error && (
            <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="confirmar" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Boton>
          </div>
        </form>
      </Modal>
    </>
  );
}
