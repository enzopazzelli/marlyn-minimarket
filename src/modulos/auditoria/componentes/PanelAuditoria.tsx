"use client";

import { useMemo, useState } from "react";
import { Campo } from "@/componentes/Campo";
import { Insignia } from "@/componentes/Insignia";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { formatearFechaHora } from "@/lib/formato";
import { hoyISO } from "@/modulos/reportes/consultas/calculos";
import { hace30Dias, listarAuditoria } from "../consultas/auditoria";
import { INFO_TIPO_AUDITORIA } from "../tipos";
import type { MovimientoAuditoria, TipoMovimientoAuditoria, UsuarioParaFiltro } from "../tipos";
import { BotonExportarAuditoria } from "./BotonExportarAuditoria";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const numero = new Intl.NumberFormat("es-AR");

// Los movimientos de stock van en unidades del producto (kg, litro,
// unidad — no plata); el resto va en pesos. turno_cierre es el único
// caso dinámico: negativo es faltante (la señal más directa de "pasó
// algo"), así que se marca alerta aunque el tipo en general sea ok.
function formatearMonto(movimiento: MovimientoAuditoria): string {
  if (movimiento.tipo.startsWith("stock_")) {
    const signo = movimiento.monto > 0 ? "+" : "";
    return `${signo}${numero.format(movimiento.monto)}`;
  }
  return platita.format(movimiento.monto);
}

function varianteDe(movimiento: MovimientoAuditoria): "ok" | "alerta" {
  if (movimiento.tipo === "turno_cierre") return movimiento.monto < 0 ? "alerta" : "ok";
  return INFO_TIPO_AUDITORIA[movimiento.tipo].variante;
}

export function PanelAuditoria({
  movimientosIniciales,
  usuarios,
}: {
  movimientosIniciales: MovimientoAuditoria[];
  usuarios: UsuarioParaFiltro[];
}) {
  const [desde, setDesde] = useState(hace30Dias());
  const [hasta, setHasta] = useState(hoyISO());
  const [movimientos, setMovimientos] = useState(movimientosIniciales);
  const [usuarioFiltro, setUsuarioFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nombrePorId = useMemo(() => new Map(usuarios.map((usuario) => [usuario.id, usuario.nombre])), [usuarios]);

  async function buscar(nuevoDesde: string, nuevoHasta: string) {
    if (!nuevoDesde || !nuevoHasta || nuevoDesde > nuevoHasta) return;
    setDesde(nuevoDesde);
    setHasta(nuevoHasta);
    setCargando(true);
    setError(null);
    try {
      const supabase = crearClienteNavegador();
      setMovimientos(await listarAuditoria(supabase, nuevoDesde, nuevoHasta));
    } catch {
      setError("No se pudo cargar ese rango. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  const movimientosFiltrados = movimientos.filter((movimiento) => {
    if (usuarioFiltro !== "todos" && movimiento.usuarioId !== usuarioFiltro) return false;
    if (tipoFiltro !== "todos" && movimiento.tipo !== tipoFiltro) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Campo
          etiqueta="Desde"
          id="auditoriaDesde"
          type="date"
          value={desde}
          max={hasta}
          onChange={(evento) => buscar(evento.target.value, hasta)}
        />
        <Campo
          etiqueta="Hasta"
          id="auditoriaHasta"
          type="date"
          value={hasta}
          max={hoyISO()}
          onChange={(evento) => buscar(desde, evento.target.value)}
        />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-texto-suave">Usuario</span>
          <select
            value={usuarioFiltro}
            onChange={(evento) => setUsuarioFiltro(evento.target.value)}
            className="rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-2 text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40"
          >
            <option value="todos">Todos</option>
            {usuarios.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-texto-suave">Tipo</span>
          <select
            value={tipoFiltro}
            onChange={(evento) => setTipoFiltro(evento.target.value)}
            className="rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-2 text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40"
          >
            <option value="todos">Todos</option>
            {(Object.keys(INFO_TIPO_AUDITORIA) as TipoMovimientoAuditoria[]).map((tipo) => (
              <option key={tipo} value={tipo}>
                {INFO_TIPO_AUDITORIA[tipo].etiqueta}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto">
          <BotonExportarAuditoria movimientos={movimientosFiltrados} nombrePorId={nombrePorId} />
        </div>
      </div>

      {error && (
        <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
      )}

      <div
        className={`overflow-x-auto rounded-[var(--radius-base)] border border-linea bg-superficie transition-opacity ${cargando ? "opacity-50" : ""}`}
      >
        {movimientosFiltrados.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-texto-suave">
            No hay movimientos que coincidan con lo elegido.
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Fecha", "Usuario", "Tipo", "Detalle", "Monto"].map((columna) => (
                  <th
                    key={columna}
                    className={`border-b border-linea px-2.5 py-1.5 font-[family-name:var(--font-numero)] text-[10px] font-medium uppercase tracking-wider text-texto-suave ${
                      columna === "Monto" ? "text-right" : "text-left"
                    }`}
                  >
                    {columna}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movimientosFiltrados.map((movimiento) => (
                <tr key={`${movimiento.tipo}-${movimiento.id}`} className="border-b border-linea last:border-b-0">
                  <td className="numero px-2.5 py-1.5 text-xs text-texto-suave">
                    {formatearFechaHora(movimiento.fecha)}
                  </td>
                  <td className="px-2.5 py-1.5 text-xs text-texto">
                    {movimiento.usuarioId ? (nombrePorId.get(movimiento.usuarioId) ?? "—") : "—"}
                  </td>
                  <td className="px-2.5 py-1.5">
                    <Insignia variante={varianteDe(movimiento)}>{INFO_TIPO_AUDITORIA[movimiento.tipo].etiqueta}</Insignia>
                  </td>
                  <td className="px-2.5 py-1.5 text-xs text-texto-suave">{movimiento.descripcion}</td>
                  <td className="numero px-2.5 py-1.5 text-right text-xs">{formatearMonto(movimiento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-texto-suave">
        Hasta 1000 movimientos por rango, del más reciente al más viejo. Si buscás algo más viejo, achicá el rango
        de fechas.
      </p>
    </div>
  );
}
