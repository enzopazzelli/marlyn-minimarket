"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Proveedor } from "../tipos";

// Mismo criterio que BotonEliminarProducto.tsx / "Eliminar" en
// PanelListaSimple.tsx: sin modal de confirmación, la guarda real es el
// error de FK (23503) si todavía hay productos con este proveedor.
export function BotonEliminarProveedor({ proveedor }: { proveedor: Proveedor }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function eliminar() {
    setError(null);
    setOcupado(true);
    const supabase = crearClienteNavegador();
    const { error: errorDelete } = await supabase.from("proveedores").delete().eq("id", proveedor.id);
    setOcupado(false);

    if (errorDelete) {
      if (errorDelete.code === "23503") {
        setError("Todavía hay productos con este proveedor.");
      } else {
        setError("No se pudo borrar. Probá de nuevo.");
      }
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
