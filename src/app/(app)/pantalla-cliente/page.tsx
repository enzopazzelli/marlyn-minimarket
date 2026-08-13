import { BarraSuperior } from "@/componentes/BarraSuperior";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { PanelEmparejamiento } from "@/modulos/pantalla/componentes/PanelEmparejamiento";

export default async function PaginaPantallaCliente() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: perfil } = user
    ? await supabase.from("perfiles").select("token_pantalla").eq("id", user.id).single()
    : { data: null };

  return (
    <>
      <BarraSuperior titulo="Pantalla al cliente" />
      <main className="flex-1 p-4 md:p-6">
        {perfil ? (
          <PanelEmparejamiento token={perfil.token_pantalla} />
        ) : (
          <p className="text-sm text-texto-suave">No se pudo cargar tu perfil. Probá de nuevo.</p>
        )}
      </main>
    </>
  );
}
