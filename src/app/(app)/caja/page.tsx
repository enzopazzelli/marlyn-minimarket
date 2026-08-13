import { BarraSuperior } from "@/componentes/BarraSuperior";
import { ChipCaja } from "@/componentes/ChipCaja";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { buscarTurnoAbierto } from "@/modulos/caja/consultas/caja";
import { FormularioAbrirCaja } from "@/modulos/caja/componentes/FormularioAbrirCaja";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const horaFormateador = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

export default async function PaginaCaja() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const turno = user ? await buscarTurnoAbierto(supabase, user.id) : null;

  return (
    <>
      <BarraSuperior titulo="Caja">
        <ChipCaja abierta={!!turno} />
      </BarraSuperior>
      <main className="flex-1 p-4 md:p-6">
        {turno ? (
          <div className="max-w-sm rounded-[var(--radius-base)] border border-linea bg-superficie p-5">
            <p className="text-sm text-texto-suave">Apertura</p>
            <p className="numero text-2xl font-semibold text-texto">{platita.format(turno.montoApertura)}</p>
            <p className="mt-1 text-xs text-texto-suave">
              Desde las {horaFormateador.format(new Date(turno.abiertoEn))}
            </p>
            <p className="mt-4 text-xs text-texto-suave">
              El cierre con arqueo y los movimientos manuales de caja quedan para un próximo cambio.
            </p>
          </div>
        ) : user ? (
          <FormularioAbrirCaja usuarioId={user.id} />
        ) : null}
      </main>
    </>
  );
}
