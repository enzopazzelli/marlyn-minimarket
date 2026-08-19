import type { SupabaseClient } from "@supabase/supabase-js";

// Chequeo que repiten crearOperador()/restablecerContrasena() en
// acciones.ts antes de tocar auth.admin. A diferencia de cada acción
// escrita sobre una tabla normal, acá no hay una RLS de respaldo si
// este chequeo tuviera un agujero: auth.admin bypasea todo. Función
// aparte (no "use server") para poder probarla directo con una sesión
// real en autorizacion.test.ts, sin pelear con cookies de Next.js.
export async function exigirSesionDeDueño(supabase: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No tenés una sesión activa");

  const { data: perfil } = await supabase.from("perfiles").select("rol, activo").eq("id", user.id).single();

  if (!perfil?.activo || perfil.rol !== "dueño") {
    throw new Error("Solo el dueño puede administrar usuarios");
  }
}
