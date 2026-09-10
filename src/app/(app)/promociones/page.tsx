import { BarraSuperior } from "@/componentes/BarraSuperior";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirDueño } from "@/lib/supabase/perfil";
import { listarProductos } from "@/modulos/stock/consultas/productos";
import { listarPromociones } from "@/modulos/promociones/consultas/promociones";
import { PanelPromociones } from "@/modulos/promociones/componentes/PanelPromociones";

// Dueño-only, mismo criterio que /usuarios y /auditoria: crear/editar
// promos ya está bloqueado por RLS, esto evita mostrarle la pantalla a
// un operador para que solo la vea fallar al tocar algo.
export default async function PaginaPromociones() {
  const supabase = await crearClienteServidor();
  await exigirDueño(supabase);

  const [promociones, productos] = await Promise.all([listarPromociones(supabase), listarProductos(supabase)]);

  return (
    <>
      <BarraSuperior titulo="Promociones" />
      <main className="flex-1 p-4 md:p-6">
        <PanelPromociones promocionesIniciales={promociones} productos={productos} />
      </main>
    </>
  );
}
