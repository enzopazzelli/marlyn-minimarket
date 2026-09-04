import Link from "next/link";
import { BarraSuperior } from "@/componentes/BarraSuperior";
import { Boton } from "@/componentes/Boton";
import { ChipCaja } from "@/componentes/ChipCaja";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { buscarTurnoAbierto } from "@/modulos/caja/consultas/caja";
import { listarClientes } from "@/modulos/clientes/consultas/clientes";
import { listarProductos } from "@/modulos/stock/consultas/productos";
import { listarVentasDelTurno } from "@/modulos/ventas/consultas/ventas";
import { SeccionVentas } from "@/modulos/ventas/componentes/SeccionVentas";

export default async function PaginaVentas() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const turno = user ? await buscarTurnoAbierto(supabase) : null;

  return (
    <>
      <BarraSuperior titulo="Ventas">
        <ChipCaja abierta={!!turno} />
      </BarraSuperior>
      <main className="flex-1 p-4 md:p-6">
        {turno && user ? (
          <PanelVentasConectado supabase={supabase} turnoCajaId={turno.id} usuarioId={user.id} />
        ) : (
          <div className="max-w-sm rounded-[var(--radius-base)] border border-dashed border-linea bg-superficie px-6 py-10 text-center">
            <p className="font-[family-name:var(--font-display)] text-base text-texto">
              Abrí la caja para poder vender
            </p>
            <p className="mt-2 text-sm text-texto-suave">
              Toda venta queda asociada a un turno de caja abierto.
            </p>
            <Link href="/caja" className="mt-4 inline-block">
              <Boton type="button">Ir a Caja</Boton>
            </Link>
          </div>
        )}
      </main>
    </>
  );
}

async function PanelVentasConectado({
  supabase,
  turnoCajaId,
  usuarioId,
}: {
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>;
  turnoCajaId: string;
  usuarioId: string;
}) {
  // El token es del comercio, no de quien está vendiendo (pedido del
  // dueño: la pantalla tiene que recibir la venta la haga el dueño o
  // un colaborador) — mismo valor para cualquiera que esté logueado.
  const [productos, clientes, ventas, configuracion] = await Promise.all([
    listarProductos(supabase),
    listarClientes(supabase),
    listarVentasDelTurno(supabase, turnoCajaId),
    supabase.from("configuracion_comercio").select("token_pantalla").single(),
  ]);

  return (
    <SeccionVentas
      productosIniciales={productos}
      clientes={clientes}
      turnoCajaId={turnoCajaId}
      usuarioId={usuarioId}
      tokenPantalla={configuracion.data?.token_pantalla ?? ""}
      ventasIniciales={ventas}
    />
  );
}
