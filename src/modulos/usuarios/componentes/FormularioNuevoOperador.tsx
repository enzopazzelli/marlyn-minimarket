"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import { crearOperador } from "../consultas/acciones";

function estadoInicial() {
  return { nombre: "", email: "", password: "" };
}

// Alta de empleado: guarda con rol 'operador' fijo (no hay selector de
// rol acá — para otro dueño, se crea directo en Supabase, esto es para
// el caso que realmente motivó todo el módulo). Sin infraestructura de
// email en el proyecto, la contraseña inicial se le pasa al empleado
// directo (por teléfono, en persona) — puede cambiarla más adelante si
// el sistema suma esa pantalla, y el dueño puede resetearla desde acá
// mismo (ver BotonRestablecerContraseña.tsx) si la olvida.
export function FormularioNuevoOperador() {
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
      setError("Escribí el nombre del empleado");
      return;
    }
    if (!campos.email.trim()) {
      setError("Escribí un correo");
      return;
    }
    if (campos.password.length < 6) {
      setError("La contraseña tiene que tener al menos 6 caracteres");
      return;
    }

    setGuardando(true);
    try {
      await crearOperador(campos);
      setAbierto(false);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo crear el usuario. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Boton onClick={abrir}>+ Nuevo empleado</Boton>

      <Modal titulo="Nuevo empleado" abierto={abierto} onCerrar={cerrar}>
        <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
          <Campo
            etiqueta="Nombre"
            id="nombreOperadorNuevo"
            value={campos.nombre}
            onChange={(evento) => setCampos({ ...campos, nombre: evento.target.value })}
            autoFocus
          />
          <Campo
            etiqueta="Correo"
            id="emailOperadorNuevo"
            type="email"
            autoComplete="off"
            value={campos.email}
            onChange={(evento) => setCampos({ ...campos, email: evento.target.value })}
          />
          <Campo
            etiqueta="Contraseña inicial"
            id="passwordOperadorNuevo"
            type="text"
            autoComplete="off"
            placeholder="Mínimo 6 caracteres"
            value={campos.password}
            onChange={(evento) => setCampos({ ...campos, password: evento.target.value })}
            className="font-[family-name:var(--font-numero)]"
          />
          <p className="text-xs text-texto-suave">
            El empleado entra con este correo y contraseña — pasáselos vos. Va a ver menos que vos (sin costos,
            sin Reportes, sin recargos por atraso) y todo lo que haga queda registrado con su usuario.
          </p>

          {error && (
            <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="confirmar" disabled={guardando}>
              {guardando ? "Creando…" : "Crear empleado"}
            </Boton>
          </div>
        </form>
      </Modal>
    </>
  );
}
