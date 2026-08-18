import { BarraSuperior } from "@/componentes/BarraSuperior";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirDueño } from "@/lib/supabase/perfil";
import { calcularResumenDelDia, hoyISO } from "@/modulos/reportes/consultas/calculos";
import { obtenerVentasDelDia } from "@/modulos/reportes/consultas/reportes";
import { PanelReportes } from "@/modulos/reportes/componentes/PanelReportes";
import { listarProductos } from "@/modulos/stock/consultas/productos";

// Dueño-only (Fase 2 de PLAN-ROLES-AUDITORIA.md): balance, márgenes y
// backup completo no son para el operador. La RLS ya protege los datos
// (precio_costo vía productos_visibles); esto evita que además vea la
// pantalla vacía en vez de no llegar.
export default async function PaginaReportes() {
  const supabase = await crearClienteServidor();
  await exigirDueño(supabase);
  const fecha = hoyISO();

  const [productos, ventas] = await Promise.all([
    listarProductos(supabase),
    obtenerVentasDelDia(supabase, fecha),
  ]);

  return (
    <>
      <BarraSuperior titulo="Reportes" />
      <main className="flex-1 p-4 md:p-6">
        <PanelReportes
          fechaInicial={fecha}
          resumenInicial={calcularResumenDelDia(ventas)}
          ventasIniciales={ventas}
          productos={productos}
        />
      </main>
    </>
  );
}
