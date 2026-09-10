"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Insignia } from "@/componentes/Insignia";
import { useEsDueño } from "@/lib/supabase/PerfilContext";
import type { Producto } from "@/modulos/stock/tipos";
import type { PromocionAdmin } from "../consultas/promociones";
import { FormularioPromocion } from "./FormularioPromocion";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

function descripcionItems(promocion: PromocionAdmin): string {
  return promocion.items.map((item) => `${item.cantidad} × ${item.nombreProducto}`).join(" + ");
}

export function PanelPromociones({
  promocionesIniciales,
  productos,
}: {
  promocionesIniciales: PromocionAdmin[];
  productos: Producto[];
}) {
  const router = useRouter();
  // Visible a cualquier perfil activo (pedido de Jason, 2026-09-11: que
  // los colaboradores vean las promos) — crear/editar/pausar/borrar
  // sigue siendo del dueño, la RLS ya lo bloquea del lado de la base;
  // acá solo se ocultan los botones para no ofrecerle a un operador
  // algo que le va a fallar al tocarlo (mismo criterio que Stock).
  const esDueño = useEsDueño();
  // "Adjusting state when a prop changes" (react.dev), mismo criterio
  // que el resto de los formularios de Stock: un router.refresh() (tras
  // guardar/pausar/borrar) trae props nuevas y no hay que quedarse con
  // la lista vieja hasta el próximo evento.
  const [promocionesVistas, setPromocionesVistas] = useState(promocionesIniciales);
  const [promociones, setPromociones] = useState(promocionesIniciales);
  if (promocionesIniciales !== promocionesVistas) {
    setPromocionesVistas(promocionesIniciales);
    setPromociones(promocionesIniciales);
  }

  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [editando, setEditando] = useState<PromocionAdmin | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function abrirAlta() {
    setEditando(null);
    setFormularioAbierto(true);
  }

  function abrirEdicion(promocion: PromocionAdmin) {
    setEditando(promocion);
    setFormularioAbierto(true);
  }

  async function alternarActiva(promocion: PromocionAdmin) {
    setError(null);
    setOcupada(promocion.id);
    const supabase = crearClienteNavegador();
    const { error: errorRpc } = await supabase.rpc("activar_promocion", {
      p_id: promocion.id,
      p_activa: !promocion.activa,
    });
    setOcupada(null);

    if (errorRpc) {
      setError(errorRpc.message);
      return;
    }
    router.refresh();
  }

  async function eliminar(promocion: PromocionAdmin) {
    setError(null);
    setOcupada(promocion.id);
    const supabase = crearClienteNavegador();
    const { error: errorDelete } = await supabase.from("promociones").delete().eq("id", promocion.id);
    setOcupada(null);

    if (errorDelete) {
      setError("No se pudo eliminar la promoción. Probá de nuevo.");
      return;
    }
    setPromociones((anteriores) => anteriores.filter((p) => p.id !== promocion.id));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-texto-suave">
          {promociones.length === 0
            ? "Todavía no hay ninguna promoción cargada."
            : `${promociones.length} promoción${promociones.length === 1 ? "" : "es"}`}
        </p>
        {esDueño && (
          <Boton type="button" onClick={abrirAlta}>
            + Nueva promoción
          </Boton>
        )}
      </div>

      {error && (
        <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
      )}

      {promociones.length > 0 && (
        <div className="flex flex-col gap-2">
          {promociones.map((promocion) => (
            <div
              key={promocion.id}
              className="flex flex-col gap-2 rounded-[var(--radius-base)] border border-linea bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-texto">{promocion.nombre}</p>
                  <Insignia variante={promocion.activa ? "ok" : "alerta"}>
                    {promocion.activa ? "activa" : "pausada"}
                  </Insignia>
                  {promocion.necesitaRevision && <Insignia variante="alerta">necesita revisión</Insignia>}
                </div>
                <p className="numero text-xs text-texto-suave">
                  {descripcionItems(promocion)} → {platita.format(promocion.precioPromocional)}
                </p>
                {promocion.necesitaRevision && (
                  <p className="mt-0.5 text-xs text-alerta">
                    Uno de los productos de esta promo ya no está activo en Stock — no se va a poder aplicar
                    hasta que la edites.
                  </p>
                )}
              </div>
              {esDueño && (
                <div className="flex shrink-0 items-center gap-2">
                  <Boton
                    type="button"
                    variante="fantasma"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={ocupada === promocion.id}
                    onClick={() => abrirEdicion(promocion)}
                  >
                    Editar
                  </Boton>
                  <Boton
                    type="button"
                    variante="fantasma"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={ocupada === promocion.id}
                    onClick={() => alternarActiva(promocion)}
                  >
                    {promocion.activa ? "Pausar" : "Reactivar"}
                  </Boton>
                  <Boton
                    type="button"
                    variante="peligro"
                    className="px-2.5 py-1.5 text-xs"
                    disabled={ocupada === promocion.id}
                    onClick={() => eliminar(promocion)}
                  >
                    Eliminar
                  </Boton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FormularioPromocion
        productos={productos}
        promocionExistente={editando ?? undefined}
        abierto={formularioAbierto}
        onCerrar={() => setFormularioAbierto(false)}
      />
    </div>
  );
}
