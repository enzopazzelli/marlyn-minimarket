"use client";

import { useState } from "react";
import { Boton } from "@/componentes/Boton";

// Mismo criterio que exceljs en BotonExportarExcel.tsx: html-to-image
// es una librería que puede no usarse nunca en una visita, se importa
// recién al hacer click en "Descargar". "Imprimir" no necesita
// librería: dispara la impresión nativa del navegador, aislada al
// ticket por la regla @media print de globals.css.
export function AccionesTicket({ numeroVenta }: { numeroVenta?: number }) {
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    const nodo = document.getElementById("ticket-imprimible");
    if (!nodo) return;

    setError(null);
    setDescargando(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(nodo, { pixelRatio: 2 });
      const enlace = document.createElement("a");
      enlace.href = dataUrl;
      enlace.download = numeroVenta ? `ticket-venta-${numeroVenta}.png` : `ticket-${Date.now()}.png`;
      enlace.click();
    } catch {
      setError("No se pudo descargar el ticket. Probá de nuevo.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Boton type="button" variante="fantasma" className="flex-1" onClick={() => window.print()}>
          Imprimir
        </Boton>
        <Boton type="button" variante="fantasma" className="flex-1" onClick={descargar} disabled={descargando}>
          {descargando ? "Descargando…" : "Descargar"}
        </Boton>
      </div>
      {error && <p className="text-xs text-alerta">{error}</p>}
    </div>
  );
}
