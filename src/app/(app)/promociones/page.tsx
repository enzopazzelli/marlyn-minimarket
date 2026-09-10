import { BarraSuperior } from "@/componentes/BarraSuperior";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { listarProductos } from "@/modulos/stock/consultas/productos";
import { listarPromociones } from "@/modulos/promociones/consultas/promociones";
import { PanelPromociones } from "@/modulos/promociones/componentes/PanelPromociones";

// Visible a cualquier perfil activo (pedido de Jason, 2026-09-11: que
// los colaboradores vean las promos) — a diferencia de /usuarios y
// /auditoria, acá no hace falta exigirDueño(): PanelPromociones.tsx
// oculta los botones de crear/editar/pausar/borrar para quien no sea
// dueño, y la RLS de "promociones"/"promociones_items" ya bloquea esas
// operaciones del lado de la base pase lo que pase en la pantalla.
export default async function PaginaPromociones() {
  const supabase = await crearClienteServidor();

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
