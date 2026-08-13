import { BarraSuperior } from "@/componentes/BarraSuperior";
import { ChipCaja } from "@/componentes/ChipCaja";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { buscarTurnoAbierto, calcularEfectivoEsperado } from "@/modulos/caja/consultas/caja";
import { FormularioAbrirCaja } from "@/modulos/caja/componentes/FormularioAbrirCaja";
import { FormularioCerrarCaja } from "@/modulos/caja/componentes/FormularioCerrarCaja";
import { listarVentasDelTurno } from "@/modulos/ventas/consultas/ventas";
import { ListaVentasDelTurno } from "@/modulos/ventas/componentes/ListaVentasDelTurno";

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
          <TurnoAbierto supabase={supabase} turno={turno} />
        ) : user ? (
          <FormularioAbrirCaja usuarioId={user.id} />
        ) : null}
      </main>
    </>
  );
}

async function TurnoAbierto({
  supabase,
  turno,
}: {
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>;
  turno: NonNullable<Awaited<ReturnType<typeof buscarTurnoAbierto>>>;
}) {
  const [montoCalculado, ventas] = await Promise.all([
    calcularEfectivoEsperado(supabase, turno.id, turno.montoApertura),
    listarVentasDelTurno(supabase, turno.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-base)] border border-linea bg-superficie p-5">
        <div className="flex-1">
          <p className="text-sm text-texto-suave">Apertura</p>
          <p className="numero text-2xl font-semibold text-texto">{platita.format(turno.montoApertura)}</p>
          <p className="mt-1 text-xs text-texto-suave">
            Desde las {horaFormateador.format(new Date(turno.abiertoEn))}
          </p>
        </div>
        <FormularioCerrarCaja turnoId={turno.id} montoCalculado={montoCalculado} />
      </div>

      <ListaVentasDelTurno ventas={ventas} />

      <p className="text-xs text-texto-suave">
        Retiros/ingresos manuales de caja quedan para un próximo cambio.
      </p>
    </div>
  );
}
