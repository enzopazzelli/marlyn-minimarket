"use server";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { exigirSesionDeDueño } from "./autorizacion";
import { emailDesdeUsuario, validarUsuario } from "./usuario";

// Primeras Server Actions de este proyecto: todo lo demás se resolvía
// con RLS + funciones security definer en la base, pero dar de alta un
// usuario o resetearle la contraseña son operaciones de auth.admin —
// no existen como función SQL, necesitan la clave de servicio, y esa
// clave jamás puede llegar al navegador (por eso crearClienteAdmin()
// vive detrás de "server-only"). Cada acción repite su propio chequeo
// de "sos dueño": una Server Action es un endpoint más, no hereda solo
// por estar linkeada desde una pantalla dueño-only.
export async function crearOperador(datos: { nombre: string; usuario: string; password: string }) {
  const supabase = await crearClienteServidor();
  await exigirSesionDeDueño(supabase);

  const nombre = datos.nombre.trim();

  if (!nombre) throw new Error("Escribí el nombre del colaborador");

  const errorUsuario = validarUsuario(datos.usuario);
  if (errorUsuario) throw new Error(errorUsuario);
  if (datos.password.length < 6) throw new Error("La contraseña tiene que tener al menos 6 caracteres");

  // Auth necesita un email; el colaborador nunca lo ve ni lo usa.
  const email = emailDesdeUsuario(datos.usuario);

  const admin = crearClienteAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: datos.password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(
      /registered/i.test(error?.message ?? "")
        ? "Ya existe un usuario con ese nombre"
        : "No se pudo crear el usuario. Probá de nuevo.",
    );
  }

  // gestionar_usuario_nuevo() (trigger de Núcleo) ya insertó la fila en
  // perfiles con rol 'dueño' por defecto y nombre = email — se corrige acá.
  const { error: errorPerfil } = await admin
    .from("perfiles")
    .update({ nombre, rol: "operador" })
    .eq("id", data.user.id);

  if (errorPerfil) {
    // No dejar un usuario a medio configurar (con rol 'dueño' de
    // sobra) si el segundo paso falla.
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error("No se pudo terminar de configurar el usuario. Probá de nuevo.");
  }
}

export async function restablecerContraseña(usuarioId: string, nuevaContraseña: string) {
  const supabase = await crearClienteServidor();
  await exigirSesionDeDueño(supabase);

  if (nuevaContraseña.length < 6) throw new Error("La contraseña tiene que tener al menos 6 caracteres");

  const admin = crearClienteAdmin();
  const { error } = await admin.auth.admin.updateUserById(usuarioId, { password: nuevaContraseña });

  if (error) throw new Error("No se pudo cambiar la contraseña. Probá de nuevo.");
}
