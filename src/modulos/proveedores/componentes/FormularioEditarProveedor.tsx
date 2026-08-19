"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { useEsDueño } from "@/lib/supabase/PerfilContext";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import type { Proveedor } from "../tipos";

function estadoDesdeProveedor(proveedor: Proveedor) {
  return {
    nombre: proveedor.nombre,
    contacto: proveedor.contacto ?? "",
    telefono: proveedor.telefono ?? "",
  };
}

// Dueño-only (Fase 5 de PLAN-ROLES-AUDITORIA.md): el operador tiene
// solo lectura + "Productos y pedido" en Proveedores.
export function FormularioEditarProveedor({ proveedor }: { proveedor: Proveedor }) {
  const esDueño = useEsDueño();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [campos, setCampos] = useState(estadoDesdeProveedor(proveedor));
  const [error, setError] = useState<string | null>(null);

  if (!esDueño) return null;

  function abrir() {
    setCampos(estadoDesdeProveedor(proveedor));
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
    const { error: errorUpdate } = await supabase
      .from("proveedores")
      .update({
        nombre: campos.nombre.trim(),
        contacto: campos.contacto.trim() || null,
        telefono: campos.telefono.trim() || null,
      })
      .eq("id", proveedor.id);
    setGuardando(false);

    if (errorUpdate) {
      setError("No se pudo guardar el proveedor. Probá de nuevo.");
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

      <Modal titulo={`Editar ${proveedor.nombre}`} abierto={abierto} onCerrar={cerrar}>
        <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
          <Campo
            etiqueta="Nombre"
            id={`nombreProveedor-${proveedor.id}`}
            value={campos.nombre}
            onChange={(evento) => setCampos({ ...campos, nombre: evento.target.value })}
          />
          <Campo
            etiqueta="Contacto (opcional)"
            id={`contactoProveedor-${proveedor.id}`}
            placeholder="Nombre de la persona de contacto"
            value={campos.contacto}
            onChange={(evento) => setCampos({ ...campos, contacto: evento.target.value })}
          />
          <Campo
            etiqueta="Teléfono (opcional)"
            id={`telefonoProveedor-${proveedor.id}`}
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
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Boton>
          </div>
        </form>
      </Modal>
    </>
  );
}
