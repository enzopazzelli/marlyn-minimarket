"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/componentes/Boton";
import { Modal } from "@/componentes/Modal";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { useEsDueño } from "@/lib/supabase/PerfilContext";
import { eliminarProducto } from "../consultas/eliminarProducto";
import type { Producto } from "../tipos";

// Con modal de confirmación desde 2026-09-02, a pedido del cliente:
// "Eliminar" es un link chico al lado de "Editar" en cada fila de una
// tabla larga, y antes borraba de una — un click de más y el producto
// desaparecía sin aviso.
//
// Si el producto ya tiene ventas o movimientos de stock,
// eliminarProducto() lo marca "eliminado" (activo = false) en vez de
// bloquear el borrado; desde acá se ve igual, la fila desaparece de la
// lista en los dos casos. Dueño-only (Fase 5 de
// PLAN-ROLES-AUDITORIA.md).
export function BotonEliminarProducto({ producto }: { producto: Producto }) {
  const esDueño = useEsDueño();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!esDueño) return null;

  function abrir() {
    setError(null);
    setAbierto(true);
  }

  async function eliminar() {
    setError(null);
    setOcupado(true);
    const supabase = crearClienteNavegador();
    const resultado = await eliminarProducto(supabase, producto.id);
    setOcupado(false);

    if (resultado === "error") {
      setError("No se pudo borrar. Probá de nuevo.");
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
        className="text-xs text-texto-suave underline decoration-dotted underline-offset-2 hover:text-alerta"
      >
        Eliminar
      </button>

      <Modal titulo="Eliminar producto" abierto={abierto} onCerrar={() => setAbierto(false)}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-texto">
            ¿Seguro que querés eliminar <strong>{producto.nombre}</strong>?
          </p>
          <p className="text-xs text-texto-suave">
            No se va a poder vender más ni va a aparecer en el listado de Stock. Si el producto ya tiene ventas,
            se conserva en el historial para que los tickets y los reportes viejos sigan cerrando.
          </p>

          {error && (
            <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={() => setAbierto(false)} disabled={ocupado}>
              Cancelar
            </Boton>
            <Boton type="button" variante="peligro" onClick={eliminar} disabled={ocupado}>
              {ocupado ? "Eliminando…" : "Sí, eliminar"}
            </Boton>
          </div>
        </div>
      </Modal>
    </>
  );
}
