import { BarraSuperior } from "@/componentes/BarraSuperior";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { PanelEmparejamiento } from "@/modulos/pantalla/componentes/PanelEmparejamiento";

// El token es del COMERCIO, no de quien está mirando esta pantalla
// (pedido del dueño: el link tiene que ser el mismo lo abra el dueño o
// un colaborador) — se lee de configuracion_comercio, una tabla de una
// sola fila, no de perfiles.
export default async function PaginaPantallaCliente() {
  const supabase = await crearClienteServidor();
  const { data: configuracion } = await supabase
    .from("configuracion_comercio")
    .select("token_pantalla")
    .single();

  return (
    <>
      <BarraSuperior titulo="Pantalla al cliente" />
      <main className="flex-1 p-4 md:p-6">
        {configuracion ? (
          <PanelEmparejamiento token={configuracion.token_pantalla} />
        ) : (
          <p className="text-sm text-texto-suave">No se pudo cargar el link. Probá de nuevo.</p>
        )}
      </main>
    </>
  );
}
