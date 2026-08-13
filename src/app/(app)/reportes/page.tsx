import { BarraSuperior } from "@/componentes/BarraSuperior";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { calcularResumenDelDia, hoyISO } from "@/modulos/reportes/consultas/calculos";
import { obtenerVentasDelDia } from "@/modulos/reportes/consultas/reportes";
import { PanelReportes } from "@/modulos/reportes/componentes/PanelReportes";
import { listarProductos } from "@/modulos/stock/consultas/productos";

export default async function PaginaReportes() {
  const supabase = await crearClienteServidor();
  const fecha = hoyISO();

  const [productos, ventas] = await Promise.all([
    listarProductos(supabase),
    obtenerVentasDelDia(supabase, fecha),
  ]);

  return (
    <>
      <BarraSuperior titulo="Reportes" />
      <main className="flex-1 p-4 md:p-6">
        <PanelReportes fechaInicial={fecha} resumenInicial={calcularResumenDelDia(ventas)} productos={productos} />
      </main>
    </>
  );
}
