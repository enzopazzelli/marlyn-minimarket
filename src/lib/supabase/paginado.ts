import type { SupabaseClient } from "@supabase/supabase-js";

const TAMANO_PAGINA = 1000;

// Cuántas páginas se piden en paralelo por tanda. 4 páginas cubren
// 4000 filas en un solo viaje de ida y vuelta — de sobra para el
// catálogo real (~2991 productos) sin necesidad de una consulta de
// conteo previa. Si una tabla algún día supera eso, el `while` de
// abajo simplemente pide otra tanda de 4 en paralelo.
const PAGINAS_POR_TANDA = 4;

// PostgREST corta cualquier select en 1000 filas (`max_rows` de
// supabase/config.toml) aunque no se pida un `.limit()` — cualquier
// consulta sobre una tabla que pueda superar esa cantidad (el catálogo
// real de este cliente tiene ~2991 productos) tiene que pasar por acá
// en vez de un `.select()` directo, o se trunca sin ningún error
// visible. Encontrado primero en BotonDescargarBackup.tsx; ahora
// también lo necesita listarProductos() — cualquier otra consulta que
// pueda cruzar las 1000 filas debería usar esto también.
//
// Las páginas de cada tanda se piden con Promise.all en vez de una por
// una: para el catálogo real (3 páginas) eso es 1 ida y vuelta en vez
// de 3 encadenadas — se nota en /stock y /ventas, que cargan el
// catálogo completo en cada visita.
//
// Ordena por `id` de forma estable por defecto: paginar con `.range()`
// sin un orden determinístico no garantiza filas consistentes entre
// una página y la siguiente si Postgres elige un plan de scan
// distinto — algo que puede pasar aunque sea raro. Si se pasa un orden
// propio (por ejemplo, más reciente primero), agregar `id` como
// desempate evita el mismo problema cuando dos filas comparten el
// valor de esa columna.
export async function traerTodasLasFilas<T>(
  supabase: SupabaseClient,
  tabla: string,
  columnas: string,
  ordenar: { columna: string; ascendente?: boolean }[] = [{ columna: "id", ascendente: true }],
): Promise<T[]> {
  function traerPagina(pagina: number) {
    let consulta = supabase.from(tabla).select(columnas);
    for (const orden of ordenar) {
      consulta = consulta.order(orden.columna, { ascending: orden.ascendente ?? true });
    }
    const desde = pagina * TAMANO_PAGINA;
    return consulta.range(desde, desde + TAMANO_PAGINA - 1);
  }

  const filas: T[] = [];
  let pagina = 0;
  let tandaCompleta = true;

  while (tandaCompleta) {
    const resultados = await Promise.all(
      Array.from({ length: PAGINAS_POR_TANDA }, (_, indice) => traerPagina(pagina + indice)),
    );

    tandaCompleta = true;
    for (const { data, error } of resultados) {
      if (error) throw error;
      const datos = (data ?? []) as T[];
      filas.push(...datos);
      // Si alguna página de la tanda vino incompleta, las siguientes
      // (offset mayor) están garantizadas vacías — no hace falta pedir
      // otra tanda.
      if (datos.length < TAMANO_PAGINA) tandaCompleta = false;
    }

    pagina += PAGINAS_POR_TANDA;
  }

  return filas;
}
