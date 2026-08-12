import type { ReactNode } from "react";

// Título de la vista + el estado que importa siempre (sección 4.3).
// El estado de caja se conecta cuando se construya el módulo Caja; por
// ahora el slot `children` queda libre para eso.
export function BarraSuperior({
  titulo,
  children,
}: {
  titulo: string;
  children?: ReactNode;
}) {
  const fecha = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-linea bg-superficie px-4 py-3 md:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-lg text-texto">
        {titulo}
      </h1>
      <div className="flex items-center gap-3 text-sm text-texto-suave">
        <span className="numero capitalize">{fecha}</span>
        {children}
      </div>
    </header>
  );
}
