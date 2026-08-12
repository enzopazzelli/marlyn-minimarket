import { createBrowserClient } from "@supabase/ssr";

// Cliente para Client Components. La clave anon es pública a propósito:
// la barrera real de seguridad es la RLS en la base, no este archivo.
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
