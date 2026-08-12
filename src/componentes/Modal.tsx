"use client";

import { useEffect, type ReactNode } from "react";

// Portado de .modal-fondo/.modal del mockup: cierra con click afuera o
// Escape, nunca con una X perdida arriba a la derecha (el mostrador no
// tiene tiempo para apuntar fino).
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-marco/55 p-5"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl bg-superficie p-6"
      >
        <h2
          id="modal-titulo"
          className="mb-4 font-[family-name:var(--font-display)] text-lg text-texto"
        >
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  );
}
