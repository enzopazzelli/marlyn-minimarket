import type { ReactNode } from "react";

// Título de la vista + el estado que importa siempre (sección 4.3).
// El estado de caja se conecta cuando se construya el módulo Caja; por
// ahora el slot `children` queda libre para eso.
export function BarraSuperior({
  titulo,
  centrarInfo = false,
  children,
}: {
  titulo: string;
  // Pedido de Jason (2026-09-17), solo para /ventas: la fecha + "Caja
  // abierta" quedaban pegadas a la derecha con mucho espacio vacío al
  // medio. Es un prop aparte (no el comportamiento default de este
  // componente compartido) porque en otras pantallas (Stock,
  // Proveedores) el mismo slot `children` lleva botones de acción, y
  // ahí sí tiene sentido que queden a la derecha.
  centrarInfo?: boolean;
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
      <div
        className={`flex items-center gap-3 text-sm text-texto-suave ${
          centrarInfo ? "absolute left-1/2 -translate-x-1/2" : ""
        }`}
      >
        <span className="numero capitalize">{fecha}</span>
        {children}
      </div>
    </header>
  );
}
