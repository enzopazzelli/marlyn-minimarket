"use client";

import { useState } from "react";
import { Boton } from "@/componentes/Boton";

// El origin depende del navegador que abre esta pantalla (podría ser
// otro que el de la TV) — se lee en el cliente, no se hardcodea.
// Inicializador perezoso (mismo criterio que cargarCarritosGuardados()
// en PanelVentas.tsx): en el servidor da "", en el navegador ya
// arranca con el valor real, sin pasar por un efecto.
function origenActual(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

// Emparejamiento fijo: el link no cambia (token_pantalla vive en el
// perfil del dueño, no en el turno) — se escribe una vez en la TV del
// mostrador y funciona todos los días. Mismo patrón de "Copiar" que
// PanelPedidoProveedor.tsx.
export function PanelEmparejamiento({ token }: { token: string }) {
  const [origen] = useState(origenActual);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = origen ? `${origen}/pantalla/${token}` : "";

  async function copiar() {
    if (!link) return;
    setError(null);
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setError("No se pudo copiar. Seleccioná el texto a mano.");
    }
  }

  return (
    <div className="max-w-lg rounded-[var(--radius-base)] border border-linea bg-superficie p-6">
      <p className="font-[family-name:var(--font-display)] text-base text-texto">
        Emparejar la TV del mostrador
      </p>
      <p className="mt-2 text-sm text-texto-suave">
        Abrí este link una sola vez en el navegador de la TV — queda
        emparejada para siempre, no hace falta repetirlo cada vez que
        abrís la caja.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(evento) => evento.currentTarget.select()}
          className="numero flex-1 rounded-[var(--radius-base)] border border-linea bg-fondo px-3 py-2 text-sm text-texto outline-none"
        />
        <Boton type="button" variante="confirmar" onClick={copiar}>
          {copiado ? "¡Copiado!" : "Copiar"}
        </Boton>
      </div>
      {error && <p className="mt-2 text-sm text-alerta">{error}</p>}
    </div>
  );
}
