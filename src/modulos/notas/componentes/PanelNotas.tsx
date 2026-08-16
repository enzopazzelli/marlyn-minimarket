"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/componentes/Boton";
import { formatearHora } from "@/lib/formato";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Nota } from "../tipos";

const fechaFormateador = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Lista general de notas sueltas (pedido explícito de Enzo, 2026-08-14):
// texto libre + fecha automática, sin título ni categoría — para
// cualquier uso, desde pegar un pedido que se le mandó a un proveedor
// hasta un recordatorio cualquiera. El formulario de alta queda siempre
// visible arriba de la lista, no en un modal aparte: la idea es poder
// pegar algo rápido, no abrir un paso extra para hacerlo.
export function PanelNotas({ notasIniciales }: { notasIniciales: Nota[] }) {
  const router = useRouter();
  // "Adjusting state when a prop changes" — mismo patrón que
  // PanelListaSimple.tsx / FormularioEditarProducto.tsx.
  const [notasVistas, setNotasVistas] = useState(notasIniciales);
  const [notas, setNotas] = useState(notasIniciales);
  if (notasIniciales !== notasVistas) {
    setNotasVistas(notasIniciales);
    setNotas(notasIniciales);
  }

  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function agregar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!texto.trim()) {
      setError("Escribí algo antes de guardar");
      return;
    }

    setError(null);
    setGuardando(true);
    const supabase = crearClienteNavegador();
    const { error: errorInsert } = await supabase.from("notas").insert({ texto: texto.trim() });
    setGuardando(false);

    if (errorInsert) {
      setError("No se pudo guardar la nota. Probá de nuevo.");
      return;
    }

    setTexto("");
    router.refresh();
  }

  async function eliminar(id: string) {
    setError(null);
    setEliminando(id);
    const supabase = crearClienteNavegador();
    const { error: errorDelete } = await supabase.from("notas").delete().eq("id", id);
    setEliminando(null);

    if (errorDelete) {
      setError("No se pudo borrar la nota. Probá de nuevo.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={agregar}
        className="flex flex-col gap-2 rounded-[var(--radius-base)] border border-linea bg-superficie p-4"
      >
        <label htmlFor="notaNueva" className="text-sm text-texto-suave">
          Nueva nota
        </label>
        <textarea
          id="notaNueva"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          rows={4}
          placeholder="Escribí o pegá lo que necesites — un pedido a un proveedor, un recordatorio…"
          className="resize-y rounded-[var(--radius-base)] border border-linea bg-fondo px-3 py-2 text-sm text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40"
        />
        <div className="flex items-center justify-between gap-3">
          {error ? <p className="text-xs text-alerta">{error}</p> : <span />}
          <Boton type="submit" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar nota"}
          </Boton>
        </div>
      </form>

      {notas.length === 0 ? (
        <p className="py-8 text-center text-sm text-texto-suave">Todavía no hay ninguna nota guardada.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notas.map((nota) => (
            <li
              key={nota.id}
              className="flex flex-col gap-2 rounded-[var(--radius-base)] border border-linea bg-superficie p-4"
            >
              <p className="whitespace-pre-wrap text-sm text-texto">{nota.texto}</p>
              <div className="flex items-center justify-between gap-3">
                <span className="numero text-xs text-texto-suave">
                  {fechaFormateador.format(new Date(nota.creadoEn))} · {formatearHora(nota.creadoEn)}
                </span>
                <button
                  type="button"
                  onClick={() => eliminar(nota.id)}
                  disabled={eliminando === nota.id}
                  className="text-xs text-texto-suave underline decoration-dotted underline-offset-2 hover:text-alerta disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
