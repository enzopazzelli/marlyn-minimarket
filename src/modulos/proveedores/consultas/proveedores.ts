import type { SupabaseClient } from "@supabase/supabase-js";
import type { Proveedor } from "../tipos";

type FilaProveedor = {
  id: string;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
};

export async function listarProveedores(supabase: SupabaseClient): Promise<Proveedor[]> {
  const { data, error } = await supabase
    .from("proveedores")
    .select("id, nombre, contacto, telefono")
    .order("nombre", { ascending: true });

  if (error) throw error;

  return (data ?? []) as FilaProveedor[];
}
