import type { SupabaseClient } from "@supabase/supabase-js";
import type { Nota } from "../tipos";

type FilaNota = {
  id: string;
  texto: string;
  creado_en: string;
};

export async function listarNotas(supabase: SupabaseClient): Promise<Nota[]> {
  const { data, error } = await supabase
    .from("notas")
    .select("id, texto, creado_en")
    .order("creado_en", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as FilaNota[]).map((fila) => ({
    id: fila.id,
    texto: fila.texto,
    creadoEn: fila.creado_en,
  }));
}
