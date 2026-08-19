import { BarraSuperior } from "@/componentes/BarraSuperior";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { exigirDueño } from "@/lib/supabase/perfil";
import { hace30Dias, listarAuditoria, listarUsuariosParaFiltro } from "@/modulos/auditoria/consultas/auditoria";
import { PanelAuditoria } from "@/modulos/auditoria/componentes/PanelAuditoria";
import { hoyISO } from "@/modulos/reportes/consultas/calculos";

// Dueño-only (Fase 4 de PLAN-ROLES-AUDITORIA.md): quién hizo qué,
// última pieza del pedido original. auditoria_movimientos ya se filtra
// sola a dueño-only (su propio where, no solo esta pantalla).
export default async function PaginaAuditoria() {
  const supabase = await crearClienteServidor();
  await exigirDueño(supabase);

  const hasta = hoyISO();
  const desde = hace30Dias();

  const [movimientos, usuarios] = await Promise.all([
    listarAuditoria(supabase, desde, hasta),
    listarUsuariosParaFiltro(supabase),
  ]);

  return (
    <>
      <BarraSuperior titulo="Auditoría" />
      <main className="flex-1 p-4 md:p-6">
        <PanelAuditoria movimientosIniciales={movimientos} usuarios={usuarios} />
      </main>
    </>
  );
}
