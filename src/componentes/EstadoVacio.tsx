// Nunca una tabla en blanco (sección 4.4): título corto que dice qué
// falta y una línea que invita a la acción.
export function EstadoVacio({
  titulo,
  descripcion,
}: {
  titulo: string;
  descripcion: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-base)] border border-dashed border-linea bg-superficie px-6 py-16 text-center">
      <p className="font-[family-name:var(--font-display)] text-base text-texto">
        {titulo}
      </p>
      <p className="max-w-sm text-sm text-texto-suave">{descripcion}</p>
    </div>
  );
}
