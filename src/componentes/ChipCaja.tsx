// Punto de color + texto, mismo lenguaje visual que .chip/.chip__punto
// del mockup. BarraSuperior ya tenía el slot children pensado para esto.
export function ChipCaja({ abierta }: { abierta: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-linea px-2.5 py-1 font-[family-name:var(--font-numero)] text-[11px] text-texto">
      <span className={`h-1.5 w-1.5 rounded-full ${abierta ? "bg-ok" : "bg-alerta"}`} />
      {abierta ? "Caja abierta" : "Caja cerrada"}
    </span>
  );
}
