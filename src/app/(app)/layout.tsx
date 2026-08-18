import { BarraLateral } from "@/componentes/BarraLateral";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/supabase/perfil";

// Server Component: trae el perfil (nombre/rol) una sola vez acá arriba
// y lo baja a BarraLateral, que decide qué ítems de navegación mostrar
// según el rol (Fase 2 de PLAN-ROLES-AUDITORIA.md). src/proxy.ts ya
// redirige a /ingresar sin sesión; obtenerPerfilActual cubre además el
// caso de un perfil desactivado.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await crearClienteServidor();
  const perfil = await obtenerPerfilActual(supabase);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <BarraLateral perfil={perfil} />
      <div className="flex min-w-0 flex-1 flex-col bg-fondo">{children}</div>
    </div>
  );
}
