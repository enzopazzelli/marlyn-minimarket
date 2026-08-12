type VarianteInsignia = "ok" | "alerta";

const clasesPorVariante: Record<VarianteInsignia, string> = {
  ok: "bg-ok-fondo text-ok",
  alerta: "bg-alerta-fondo text-alerta",
};

// Portado de .marca-estado del mockup: pill chico para "ok"/"reponer",
// "al día"/"debe", etc. Reusado por cualquier módulo que necesite marcar
// un estado en una fila de tabla.
export function Insignia({
  variante,
  children,
}: {
  variante: VarianteInsignia;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 font-[family-name:var(--font-numero)] text-[10px] tracking-wide ${clasesPorVariante[variante]}`}
    >
      {children}
    </span>
  );
}
