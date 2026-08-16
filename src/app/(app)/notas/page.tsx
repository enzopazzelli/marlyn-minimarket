import { BarraSuperior } from "@/componentes/BarraSuperior";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { listarNotas } from "@/modulos/notas/consultas/notas";
import { PanelNotas } from "@/modulos/notas/componentes/PanelNotas";

export default async function PaginaNotas() {
  const supabase = await crearClienteServidor();
  const notas = await listarNotas(supabase);

  return (
    <>
      <BarraSuperior titulo="Notas" />
      <main className="flex-1 p-4 md:p-6">
        <PanelNotas notasIniciales={notas} />
      </main>
    </>
  );
}
