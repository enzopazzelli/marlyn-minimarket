import type { SupabaseClient } from "@supabase/supabase-js";

const TAMANO_PAGINA = 1000;

// PostgREST corta cualquier select en 1000 filas (`max_rows` de
// supabase/config.toml) aunque no se pida un `.limit()` — cualquier
// consulta sobre una tabla que pueda superar esa cantidad (el catálogo
// real de este cliente tiene ~2991 productos) tiene que pasar por acá
// en vez de un `.select()` directo, o se trunca sin ningún error
// visible. Encontrado primero en BotonDescargarBackup.tsx; ahora
// también lo necesita listarProductos() — cualquier otra consulta que
// pueda cruzar las 1000 filas debería usar esto también.
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
  const filas: T[] = [];
  let desde = 0;

  while (true) {
    let consulta = supabase.from(tabla).select(columnas);
    for (const orden of ordenar) {
      consulta = consulta.order(orden.columna, { ascending: orden.ascendente ?? true });
    }

    const { data, error } = await consulta.range(desde, desde + TAMANO_PAGINA - 1);
    if (error) throw error;

    filas.push(...((data ?? []) as T[]));
    if (!data || data.length < TAMANO_PAGINA) break;
    desde += TAMANO_PAGINA;
  }

  return filas;
}
