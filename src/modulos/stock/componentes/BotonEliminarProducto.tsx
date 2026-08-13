"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { eliminarProducto } from "../consultas/eliminarProducto";
import type { Producto } from "../tipos";

// Sin modal de confirmación. Si el producto ya tiene ventas o
// movimientos de stock, eliminarProducto() lo marca "eliminado"
// (activo = false) en vez de bloquear el borrado — desde acá se ve
// igual, la fila desaparece de la lista en los dos casos.
export function BotonEliminarProducto({ producto }: { producto: Producto }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={eliminar}
        disabled={ocupado}
        className="text-xs text-texto-suave underline decoration-dotted underline-offset-2 hover:text-alerta disabled:opacity-50"
      >
        Eliminar
      </button>
      {error && <p className="max-w-[170px] text-right text-[10px] text-alerta">{error}</p>}
    </div>
  );
}
