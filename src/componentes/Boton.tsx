import type { ButtonHTMLAttributes } from "react";

type VarianteBoton = "solido" | "fantasma" | "confirmar" | "peligro";

const clasesPorVariante: Record<VarianteBoton, string> = {
  solido: "bg-acento text-acento-texto hover:brightness-95",
  fantasma: "border border-linea bg-transparent text-texto hover:bg-superficie",
  confirmar: "bg-ok text-white hover:brightness-110",
  peligro: "bg-alerta text-white hover:brightness-110",
};

export function Boton({
  variante = "solido",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBoton }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-base)] px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acento ${clasesPorVariante[variante]} ${className}`}
      {...props}
    />
  );
}
