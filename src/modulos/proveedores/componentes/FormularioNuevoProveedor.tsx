"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";

// Alta completa (nombre + contacto + teléfono), para usar acá en
// /proveedores. La alta rápida por nombre solo, desde Stock al cargar
// un producto, sigue existiendo aparte vía PanelListaSimple — no se
// toca.
function estadoInicial() {
  return { nombre: "", contacto: "", telefono: "" };
}

export function FormularioNuevoProveedor() {
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
      setError("Escribí el nombre del proveedor");
      return;
    }

    setGuardando(true);
    const supabase = crearClienteNavegador();
    const { error: errorInsert } = await supabase.from("proveedores").insert({
      nombre: campos.nombre.trim(),
      contacto: campos.contacto.trim() || null,
      telefono: campos.telefono.trim() || null,
    });
    setGuardando(false);

    if (errorInsert) {
      setError("No se pudo guardar el proveedor. Probá de nuevo.");
      return;
    }

    setAbierto(false);
    router.refresh();
  }

  return (
    <>
      <Boton onClick={abrir}>+ Nuevo proveedor</Boton>

      <Modal titulo="Nuevo proveedor" abierto={abierto} onCerrar={cerrar}>
        <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
          <Campo
            etiqueta="Nombre"
            id="nombreProveedorNuevo"
            value={campos.nombre}
            onChange={(evento) => setCampos({ ...campos, nombre: evento.target.value })}
          />
          <Campo
            etiqueta="Contacto (opcional)"
            id="contactoProveedorNuevo"
            placeholder="Nombre de la persona de contacto"
            value={campos.contacto}
            onChange={(evento) => setCampos({ ...campos, contacto: evento.target.value })}
          />
          <Campo
            etiqueta="Teléfono (opcional)"
            id="telefonoProveedorNuevo"
            value={campos.telefono}
            onChange={(evento) => setCampos({ ...campos, telefono: evento.target.value })}
            className="font-[family-name:var(--font-numero)]"
          />

          {error && (
            <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="confirmar" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar proveedor"}
            </Boton>
          </div>
        </form>
      </Modal>
    </>
  );
}
