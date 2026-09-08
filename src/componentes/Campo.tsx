import { useRef, type InputHTMLAttributes } from "react";

// La etiqueta siempre arriba, nunca solo placeholder: el placeholder
// desaparece justo cuando se lo necesita (sección 4.4).
export function Campo({
  etiqueta,
  id,
  className = "",
  onFocus,
  onWheel,
  onLimpiar,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  /** Botón "✕" para vaciar el campo de un toque, sin tener que
   *  seleccionar y borrar a mano. Opcional: solo aparece si se pasa
   *  esta prop, y solo mientras el campo tenga algo escrito. Pensado
   *  para buscadores (Carga rápida de stock) — no seleccionar todo
   *  solo al enfocar, para no arriesgar borrar a mitad de tipeo una
   *  búsqueda larga si el cajero hace una pausa (ver
   *  ListaProductos.tsx, mismo criterio en el buscador principal). */
  onLimpiar?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tieneTexto = typeof props.value === "string" && props.value !== "";

  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm">
      <span className="text-texto-suave">{etiqueta}</span>
      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          onFocus={(evento) => {
            // El cajero clickea y escribe directo, sin borrar el "0" que
            // trae el campo — seleccionar todo al hacer foco hace que la
            // primera tecla lo reemplace entero. Solo en numéricos: en
            // texto/fecha, seleccionar todo al clickear no es lo esperado.
            if (props.type === "number") evento.currentTarget.select();
            onFocus?.(evento);
          }}
          onWheel={(evento) => {
            // Reportado por el cliente ("de casualidad arrastro y se
            // hacen esos números"): en un input numérico enfocado, el
            // scroll del mouse (o el deslizamiento de dos dedos en el
            // trackpad) suma/resta al valor en vez de scrollear la
            // página — el bug clásico de <input type="number">. Sacarle
            // el foco antes de que el navegador procese el wheel corta
            // el cambio de valor sin bloquear el scroll de la página.
            if (props.type === "number") evento.currentTarget.blur();
            onWheel?.(evento);
          }}
          className={`w-full rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-2 text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40 ${onLimpiar ? "pr-8" : ""} ${className}`}
          {...props}
        />
        {onLimpiar && tieneTexto && (
          <button
            type="button"
            onClick={() => {
              onLimpiar();
              inputRef.current?.focus();
            }}
            aria-label="Vaciar"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-texto-suave hover:bg-fondo hover:text-texto"
          >
            ✕
          </button>
        )}
      </div>
    </label>
  );
}
