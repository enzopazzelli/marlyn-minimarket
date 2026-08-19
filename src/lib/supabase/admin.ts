import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente con la clave de servicio: bypasea RLS por completo y puede
// llamar a auth.admin (crear usuarios, resetear contraseñas — nada de
// esto existe en la API de datos normal, ni siquiera para el dueño).
// "server-only" hace fallar el build si algún Client Component llega a
// importar este archivo por error — la clave jamás llega al navegador
// (prompt-base sección 6). Solo se usa desde Server Components/Server
// Actions de /usuarios.
export function crearClienteAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
