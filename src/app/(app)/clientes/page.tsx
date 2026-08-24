import { BarraSuperior } from "@/componentes/BarraSuperior";
import { EstadoVacio } from "@/componentes/EstadoVacio";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { buscarTurnoAbierto } from "@/modulos/caja/consultas/caja";
import { listarClientes } from "@/modulos/clientes/consultas/clientes";
import { FormularioNuevoCliente } from "@/modulos/clientes/componentes/FormularioNuevoCliente";
import { ListaClientes } from "@/modulos/clientes/componentes/ListaClientes";

export default async function PaginaClientes() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [clientes, turno] = await Promise.all([
    listarClientes(supabase),
    user ? buscarTurnoAbierto(supabase) : Promise.resolve(null),
  ]);

  return (
    <>
      <BarraSuperior titulo="Clientes">
        <FormularioNuevoCliente />
      </BarraSuperior>
      <main className="flex-1 p-4 md:p-6">
        {clientes.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no cargaste ningún cliente"
            descripcion="Sumá una ficha para poder vender fiado y llevarle la cuenta corriente."
          />
        ) : (
          <ListaClientes clientes={clientes} turnoCajaId={turno?.id ?? null} />
        )}
      </main>
    </>
  );
}
