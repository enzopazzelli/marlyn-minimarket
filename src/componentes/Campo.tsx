import type { InputHTMLAttributes } from "react";

// La etiqueta siempre arriba, nunca solo placeholder: el placeholder
// desaparece justo cuando se lo necesita (sección 4.4).
export function Campo({
  etiqueta,
  id,
  className = "",
  onFocus,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm">
      <span className="text-texto-suave">{etiqueta}</span>
      <input
        id={id}
        onFocus={(evento) => {
          // El cajero clickea y escribe directo, sin borrar el "0" que
          // trae el campo — seleccionar todo al hacer foco hace que la
          // primera tecla lo reemplace entero. Solo en numéricos: en
          // texto/fecha, seleccionar todo al clickear no es lo esperado.
          if (props.type === "number") evento.currentTarget.select();
          onFocus?.(evento);
        }}
        className={`rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-2 text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40 ${className}`}
        {...props}
      />
    </label>
  );
}
