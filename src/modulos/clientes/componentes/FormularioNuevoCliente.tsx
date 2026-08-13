"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";

function estadoInicial() {
  return { nombre: "", telefono: "", direccion: "" };
}

export function FormularioNuevoCliente() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [campos, setCampos] = useState(estadoInicial());
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setCampos(estadoInicial());
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
    const { error: errorInsert } = await supabase.from("clientes").insert({
      nombre: campos.nombre.trim(),
      telefono: campos.telefono.trim() || null,
      direccion: campos.direccion.trim() || null,
    });
    setGuardando(false);

    if (errorInsert) {
      setError("No se pudo guardar el cliente. Probá de nuevo.");
      return;
    }

    setAbierto(false);
    router.refresh();
  }

  return (
    <>
      <Boton onClick={abrir}>+ Nuevo cliente</Boton>

      <Modal titulo="Nuevo cliente" abierto={abierto} onCerrar={cerrar}>
        <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
          <Campo
            etiqueta="Nombre"
            id="nombreCliente"
            value={campos.nombre}
            onChange={(evento) => setCampos({ ...campos, nombre: evento.target.value })}
          />
          <Campo
            etiqueta="Teléfono (opcional)"
            id="telefonoCliente"
            value={campos.telefono}
            onChange={(evento) => setCampos({ ...campos, telefono: evento.target.value })}
            className="font-[family-name:var(--font-numero)]"
          />
          <Campo
            etiqueta="Dirección (opcional)"
            id="direccionCliente"
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
              {guardando ? "Guardando…" : "Guardar cliente"}
            </Boton>
          </div>
        </form>
      </Modal>
    </>
  );
}
