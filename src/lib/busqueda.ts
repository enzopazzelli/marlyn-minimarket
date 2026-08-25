// Pedido explícito del cliente, 2026-08-26: en el sistema anterior
// buscar "GOM ACID" encontraba "GOMITA MOGUL ACIDAS-DIENTE" — acá no
// encontraba nada, porque el buscador de cada pantalla comparaba el
// término entero como una sola subcadena contra el texto
// (`nombre.includes(termino)`). Esto separa el término en palabras y
// exige que CADA una aparezca en algún lado del texto (sin importar el
// orden ni que sean contiguas) — "gom" está en "GOMita", "acid" está
// en "ACIDas", así que matchea aunque no sean substrings consecutivos
// del nombre completo.
export function coincideBusqueda(texto: string, termino: string): boolean {
  const palabras = termino.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;

  const textoNormalizado = texto.toLowerCase();
  return palabras.every((palabra) => textoNormalizado.includes(palabra));
}
