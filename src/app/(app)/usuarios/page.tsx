import { BarraSuperior } from "@/componentes/BarraSuperior";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { exigirDueño } from "@/lib/supabase/perfil";
import { listarUsuarios } from "@/modulos/usuarios/consultas/usuarios";
import { PanelUsuarios } from "@/modulos/usuarios/componentes/PanelUsuarios";

// Dueño-only (Fase 3 de PLAN-ROLES-AUDITORIA.md): alta de empleados,
// activar/desactivar, restablecer contraseña.
export default async function PaginaUsuarios() {
  const supabase = await crearClienteServidor();
  const perfilActual = await exigirDueño(supabase);

  const admin = crearClienteAdmin();
  const usuarios = await listarUsuarios(admin);

  return (
    <>
      <BarraSuperior titulo="Usuarios" />
      <main className="flex-1 p-4 md:p-6">
        <PanelUsuarios usuariosIniciales={usuarios} usuarioActualId={perfilActual.id} />
      </main>
    </>
  );
}
