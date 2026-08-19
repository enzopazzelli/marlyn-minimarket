import type { SupabaseClient } from "@supabase/supabase-js";
import type { Usuario } from "../tipos";

type FilaPerfil = {
  id: string;
  nombre: string;
  rol: Usuario["rol"];
  activo: boolean;
  creado_en: string;
};

// admin: hace falta auth.admin.listUsers() para el email, que no vive
// en perfiles ni es legible vía la API de datos normal. Solo se llama
// desde /usuarios/page.tsx (Server Component, dueño-only).
export async function listarUsuarios(admin: SupabaseClient): Promise<Usuario[]> {
  const [{ data: auth, error: errorAuth }, { data: perfiles, error: errorPerfiles }] = await Promise.all([
    admin.auth.admin.listUsers(),
    admin.from("perfiles").select("id, nombre, rol, activo, creado_en").order("creado_en", { ascending: true }),
  ]);

  if (errorAuth) throw errorAuth;
  if (errorPerfiles) throw errorPerfiles;

  const emailPorId = new Map(auth.users.map((usuario) => [usuario.id, usuario.email ?? ""]));

  return ((perfiles ?? []) as FilaPerfil[]).map((perfil) => ({
    id: perfil.id,
    nombre: perfil.nombre,
    email: emailPorId.get(perfil.id) ?? "",
    rol: perfil.rol,
    activo: perfil.activo,
    creadoEn: perfil.creado_en,
  }));
}
