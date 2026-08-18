import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export type Perfil = {
  id: string;
  nombre: string;
  rol: "dueño" | "operador";
  activo: boolean;
};

// Perfil de la sesión actual para Server Components. Redirige a
// /ingresar si no hay sesión o si el perfil está desactivado — sin
// esto, un operador desactivado por el dueño (Fase 3 de
// PLAN-ROLES-AUDITORIA.md) seguiría viendo pantallas rotas/vacías en
// vez de quedar afuera con claridad (la RLS ya le bloquea los datos,
// esto evita la confusión de por qué todo aparece vacío).
export async function obtenerPerfilActual(supabase: SupabaseClient): Promise<Perfil> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, activo")
    .eq("id", user.id)
    .single();

  if (!perfil || !perfil.activo) redirect("/ingresar");

  return perfil as Perfil;
}

// Para pantallas dueño-only (Reportes, y más adelante Usuarios y
// Auditoría): la barrera real ya es la RLS de cada tabla (Fase 1), esto
// solo evita que un operador llegue a ver una pantalla vacía en vez de
// no llegar directamente.
export async function exigirDueño(supabase: SupabaseClient): Promise<Perfil> {
  const perfil = await obtenerPerfilActual(supabase);
  if (perfil.rol !== "dueño") redirect("/ventas");
  return perfil;
}
