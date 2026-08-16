import { BarraSuperior } from "@/componentes/BarraSuperior";
import { ChipCaja } from "@/componentes/ChipCaja";
import { formatearHora } from "@/lib/formato";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  buscarTurnoAbierto,
  calcularEfectivoEsperado,
  listarMovimientosCaja,
  listarTurnosCerrados,
} from "@/modulos/caja/consultas/caja";
import { BotonExportarCaja } from "@/modulos/caja/componentes/BotonExportarCaja";
import { FormularioAbrirCaja } from "@/modulos/caja/componentes/FormularioAbrirCaja";
import { FormularioCerrarCaja } from "@/modulos/caja/componentes/FormularioCerrarCaja";
import { FormularioMovimientoCaja } from "@/modulos/caja/componentes/FormularioMovimientoCaja";
import { HistorialCierres } from "@/modulos/caja/componentes/HistorialCierres";
import { ListaMovimientosCaja } from "@/modulos/caja/componentes/ListaMovimientosCaja";
import { listarVentasDelTurno } from "@/modulos/ventas/consultas/ventas";
import { ListaVentasDelTurno } from "@/modulos/ventas/componentes/ListaVentasDelTurno";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default async function PaginaCaja() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const turno = user ? await buscarTurnoAbierto(supabase, user.id) : null;
  const turnosCerrados = user ? await listarTurnosCerrados(supabase) : [];

  return (
    <>
      <BarraSuperior titulo="Caja">
        <ChipCaja abierta={!!turno} />
      </BarraSuperior>
      <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        {turno ? (
          <TurnoAbierto supabase={supabase} turno={turno} />
        ) : user ? (
          <FormularioAbrirCaja usuarioId={user.id} />
        ) : null}
        {user && <HistorialCierres turnos={turnosCerrados} />}
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
  const [montoCalculado, ventas, movimientos] = await Promise.all([
    calcularEfectivoEsperado(supabase, turno.id, turno.montoApertura),
    listarVentasDelTurno(supabase, turno.id),
    listarMovimientosCaja(supabase, turno.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-base)] border border-linea bg-superficie p-5">
        <div className="flex-1">
          <p className="text-sm text-texto-suave">Apertura</p>
          <p className="numero text-2xl font-semibold text-texto">{platita.format(turno.montoApertura)}</p>
          <p className="mt-1 text-xs text-texto-suave">Desde las {formatearHora(turno.abiertoEn)}</p>
        </div>
        <div className="flex-1">
          <p className="text-sm text-texto-suave">Debería haber</p>
          <p className="numero text-2xl font-semibold text-texto">{platita.format(montoCalculado)}</p>
          <p className="mt-1 text-xs text-texto-suave">
            Apertura + efectivo cobrado + movimientos — esto es el cajón, no &ldquo;Ventas&rdquo; de Reportes
          </p>
        </div>
        <BotonExportarCaja turno={turno} montoCalculado={montoCalculado} ventas={ventas} movimientos={movimientos} />
        <FormularioCerrarCaja turnoId={turno.id} montoCalculado={montoCalculado} />
      </div>

      <ListaVentasDelTurno ventas={ventas} />

      <ListaMovimientosCaja
        movimientos={movimientos}
        accion={<FormularioMovimientoCaja turnoId={turno.id} />}
      />
    </div>
  );
}
