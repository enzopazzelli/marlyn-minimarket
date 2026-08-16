// Regla 5 de prompt-base-sistemas-gestion.md ("Reglas de seguridad no
// negociables"): toda exportación a Excel/CSV sanitiza el texto
// cargado por usuarios. Un valor que empieza con "=", "+", "-" o "@" se
// interpreta como fórmula al abrirlo (CSV/Formula Injection, OWASP) —
// se prefija con una comilla para que la celda quede como texto
// literal. Se usa en los exports que vuelcan texto libre tal cual
// (BotonDescargarBackup.tsx: nombres, motivos, y ahora notas.texto,
// pensado justo para pegar cosas de afuera).
export function celdaSegura(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;
  return /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
}

export function filaSegura(fila: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fila).map(([clave, valor]) => [clave, celdaSegura(valor)]));
}
