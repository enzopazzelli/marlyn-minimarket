"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import { crearOperador } from "../consultas/acciones";
import { validarUsuario } from "../consultas/usuario";

function estadoInicial() {
  return { nombre: "", usuario: "", password: "" };
}

// Alta de colaborador (rol 'operador' en la base): guarda con rol 'operador' fijo (no hay selector de
// rol acá — para otro dueño, se crea directo en Supabase, esto es para
// el caso que realmente motivó todo el módulo). Sin infraestructura de
// email en el proyecto, la contraseña inicial se le pasa al
// colaborador directo (por teléfono, en persona) — el dueño puede
// resetearla desde acá mismo (ver BotonRestablecerContraseña.tsx) si la
// olvida.
//
// Desde 2026-09-02 no se pide correo, a pedido del cliente: solo
// usuario y clave. Auth igual necesita un email, así que se arma uno
// interno a partir del usuario (usuario.ts) que nadie ve nunca.
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
      setError("Escribí el nombre del colaborador");
      return;
    }
    const errorUsuario = validarUsuario(campos.usuario);
    if (errorUsuario) {
      setError(errorUsuario);
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
      <Boton onClick={abrir}>+ Nuevo colaborador</Boton>

      <Modal titulo="Nuevo colaborador" abierto={abierto} onCerrar={cerrar}>
        <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
          <Campo
            etiqueta="Nombre"
            id="nombreOperadorNuevo"
            value={campos.nombre}
            onChange={(evento) => setCampos({ ...campos, nombre: evento.target.value })}
            autoFocus
          />
          <Campo
            etiqueta="Usuario"
            id="usuarioOperadorNuevo"
            type="text"
            autoComplete="off"
            placeholder="Por ejemplo: marcos"
            value={campos.usuario}
            onChange={(evento) => setCampos({ ...campos, usuario: evento.target.value })}
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
            El colaborador entra con este usuario y contraseña — pasáselos vos. Va a ver menos que vos (sin
            costos, sin Reportes, sin recargos por atraso) y todo lo que haga queda registrado con su usuario.
          </p>

          {error && (
            <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="confirmar" disabled={guardando}>
              {guardando ? "Creando…" : "Crear colaborador"}
            </Boton>
          </div>
        </form>
      </Modal>
    </>
  );
}
