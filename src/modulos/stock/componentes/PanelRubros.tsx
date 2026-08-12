"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import type { Categoria } from "../tipos";

export function PanelRubros({ categoriasIniciales }: { categoriasIniciales: Categoria[] }) {
  const router = useRouter();
  // "Adjusting state when a prop changes" (react.dev): setState durante
  // el render, no en un efecto — ver el mismo comentario en
  // FormularioNuevoProducto.tsx.
  const [categoriasVistas, setCategoriasVistas] = useState(categoriasIniciales);
  const [categorias, setCategorias] = useState(categoriasIniciales);
  if (categoriasIniciales !== categoriasVistas) {
    setCategoriasVistas(categoriasIniciales);
    setCategorias(categoriasIniciales);
  }

  const [abierto, setAbierto] = useState(false);
  const [nombresEditados, setNombresEditados] = useState<Record<string, string>>({});
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function abrir() {
    setNombresEditados({});
    setNombreNuevo("");
    setError(null);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

  async function agregar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    if (!nombreNuevo.trim()) {
      setError("Escribí el nombre del rubro");
      return;
    }

    setOcupado("nuevo");
    const supabase = crearClienteNavegador();
    const { error: errorInsert } = await supabase
      .from("categorias")
      .insert({ nombre: nombreNuevo.trim() });
    setOcupado(null);

    if (errorInsert) {
      setError("No se pudo crear el rubro. Probá de nuevo.");
      return;
    }

    setNombreNuevo("");
    router.refresh();
  }

  async function renombrar(categoria: Categoria) {
    const nombreNuevo = (nombresEditados[categoria.id] ?? categoria.nombre).trim();
    if (!nombreNuevo) {
      setError("El nombre del rubro no puede quedar vacío");
      return;
    }
    if (nombreNuevo === categoria.nombre) return;

    setError(null);
    setOcupado(categoria.id);
    const supabase = crearClienteNavegador();
    const { error: errorUpdate } = await supabase
      .from("categorias")
      .update({ nombre: nombreNuevo })
      .eq("id", categoria.id);
    setOcupado(null);

    if (errorUpdate) {
      setError("No se pudo renombrar el rubro. Probá de nuevo.");
      return;
    }

    router.refresh();
  }

  async function eliminar(categoria: Categoria) {
    setError(null);
    setOcupado(categoria.id);
    const supabase = crearClienteNavegador();
    const { error: errorDelete } = await supabase.from("categorias").delete().eq("id", categoria.id);
    setOcupado(null);

    if (errorDelete) {
      if (errorDelete.code === "23503") {
        setError(`No se puede eliminar "${categoria.nombre}": hay productos con este rubro.`);
      } else {
        setError("No se pudo eliminar el rubro. Probá de nuevo.");
      }
      return;
    }

    router.refresh();
  }

  return (
    <>
      <Boton variante="fantasma" onClick={abrir}>
        Rubros
      </Boton>

      <Modal titulo="Rubros" abierto={abierto} onCerrar={cerrar}>
        <div className="flex flex-col gap-4">
          {categorias.length === 0 ? (
            <p className="text-sm text-texto-suave">Todavía no hay ningún rubro cargado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {categorias.map((categoria) => (
                <li key={categoria.id} className="flex items-center gap-2">
                  <input
                    value={nombresEditados[categoria.id] ?? categoria.nombre}
                    onChange={(evento) =>
                      setNombresEditados({ ...nombresEditados, [categoria.id]: evento.target.value })
                    }
                    disabled={ocupado === categoria.id}
                    className="flex-1 rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-1.5 text-sm text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40"
                  />
                  <Boton
                    type="button"
                    variante="fantasma"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={ocupado === categoria.id}
                    onClick={() => renombrar(categoria)}
                  >
                    Guardar
                  </Boton>
                  <Boton
                    type="button"
                    variante="peligro"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={ocupado === categoria.id}
                    onClick={() => eliminar(categoria)}
                  >
                    Eliminar
                  </Boton>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={agregar} className="flex items-end gap-2 border-t border-linea pt-4">
            <div className="flex-1">
              <Campo
                etiqueta="Nuevo rubro"
                id="nombreRubroNuevoPanel"
                value={nombreNuevo}
                onChange={(evento) => setNombreNuevo(evento.target.value)}
              />
            </div>
            <Boton type="submit" disabled={ocupado === "nuevo"}>
              Agregar
            </Boton>
          </form>

          {error && (
            <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Boton type="button" variante="fantasma" onClick={cerrar}>
              Cerrar
            </Boton>
          </div>
        </div>
      </Modal>
    </>
  );
}
