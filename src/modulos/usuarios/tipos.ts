import type { Perfil } from "@/lib/supabase/perfil";

export type Usuario = {
  id: string;
  nombre: string;
  // Vive en auth.users, no en perfiles — se trae con auth.admin.listUsers()
  // (ver consultas/usuarios.ts), no hay forma de leerlo desde la API de
  // datos normal.
  email: string;
  rol: Perfil["rol"];
  activo: boolean;
  creadoEn: string;
};
