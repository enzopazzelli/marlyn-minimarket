"use client";

import { useEffect, type ReactNode } from "react";

// Antes cerraba con click afuera (portado de .modal-fondo/.modal del
// mockup, pensado para el mostrador). Se sacó ese cierre: en el uso
// real, un click afuera por error borraba ediciones en curso (cliente,
// proveedor, producto, cerrar caja). Ahora solo cierra con la cruz o
// con Escape.
export function Modal({
  titulo,
  abierto,
  onCerrar,
  children,
}: {
  titulo: string;
  abierto: boolean;
  onCerrar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!abierto) return;

    function alTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") onCerrar();
    }

    document.addEventListener("keydown", alTecla);
    return () => document.removeEventListener("keydown", alTecla);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-marco/55 p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-superficie p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id="modal-titulo" className="font-[family-name:var(--font-display)] text-lg text-texto">
            {titulo}
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onCerrar}
            className="shrink-0 rounded-[var(--radius-base)] px-1.5 py-0.5 text-lg leading-none text-texto-suave hover:bg-fondo hover:text-texto"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
