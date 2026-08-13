"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "./Boton";
import { Campo } from "./Campo";
import { Modal } from "./Modal";

type Item = { id: string; nombre: string };

// Listar / renombrar / alta / baja (con guarda de FK) para una tabla
// plana de solo id+nombre — mismo patrón que ya usaban categorias
// (rubro) y ahora proveedores. Si aparece una tercera tabla así, es una
// instancia más de esto, no un archivo nuevo.
export function PanelListaSimple({
  tabla,
  titulo,
  nombreSingular,
  itemsIniciales,
}: {
  tabla: string;
  titulo: string;
  nombreSingular: string;
  itemsIniciales: Item[];
}) {
  const router = useRouter();
  // "Adjusting state when a prop changes" (react.dev): setState durante
  // el render, no en un efecto — ver el mismo comentario en
  // FormularioNuevoProducto.tsx.
  const [itemsVistos, setItemsVistos] = useState(itemsIniciales);
  const [items, setItems] = useState(itemsIniciales);
  if (itemsIniciales !== itemsVistos) {
    setItemsVistos(itemsIniciales);
    setItems(itemsIniciales);
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
      setError(`Escribí el nombre del ${nombreSingular}`);
      return;
    }

    setOcupado("nuevo");
    const supabase = crearClienteNavegador();
    const { error: errorInsert } = await supabase.from(tabla).insert({ nombre: nombreNuevo.trim() });
    setOcupado(null);

    if (errorInsert) {
      setError(`No se pudo crear el ${nombreSingular}. Probá de nuevo.`);
      return;
    }

    setNombreNuevo("");
    router.refresh();
  }

  async function renombrar(item: Item) {
    const nombreNuevo = (nombresEditados[item.id] ?? item.nombre).trim();
    if (!nombreNuevo) {
      setError(`El nombre del ${nombreSingular} no puede quedar vacío`);
      return;
    }
    if (nombreNuevo === item.nombre) return;

    setError(null);
    setOcupado(item.id);
    const supabase = crearClienteNavegador();
    const { error: errorUpdate } = await supabase.from(tabla).update({ nombre: nombreNuevo }).eq("id", item.id);
    setOcupado(null);

    if (errorUpdate) {
      setError(`No se pudo renombrar el ${nombreSingular}. Probá de nuevo.`);
      return;
    }

    router.refresh();
  }

  async function eliminar(item: Item) {
    setError(null);
    setOcupado(item.id);
    const supabase = crearClienteNavegador();
    const { error: errorDelete } = await supabase.from(tabla).delete().eq("id", item.id);
    setOcupado(null);

    if (errorDelete) {
      if (errorDelete.code === "23503") {
        setError(`No se puede eliminar "${item.nombre}": hay productos con este ${nombreSingular}.`);
      } else {
        setError(`No se pudo eliminar el ${nombreSingular}. Probá de nuevo.`);
      }
      return;
    }

    router.refresh();
  }

  return (
    <>
      <Boton variante="fantasma" onClick={abrir}>
        {titulo}
      </Boton>

      <Modal titulo={titulo} abierto={abierto} onCerrar={cerrar}>
        <div className="flex flex-col gap-4">
          {items.length === 0 ? (
            <p className="text-sm text-texto-suave">Todavía no hay ningún {nombreSingular} cargado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <input
                    value={nombresEditados[item.id] ?? item.nombre}
                    onChange={(evento) =>
                      setNombresEditados({ ...nombresEditados, [item.id]: evento.target.value })
                    }
                    disabled={ocupado === item.id}
                    className="flex-1 rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-1.5 text-sm text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40"
                  />
                  <Boton
                    type="button"
                    variante="fantasma"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={ocupado === item.id}
                    onClick={() => renombrar(item)}
                  >
                    Guardar
                  </Boton>
                  <Boton
                    type="button"
                    variante="peligro"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={ocupado === item.id}
                    onClick={() => eliminar(item)}
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
                etiqueta={`Nuevo ${nombreSingular}`}
                id={`nombreNuevoPanel-${tabla}`}
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
