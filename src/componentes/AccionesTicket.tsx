"use client";

import { useState } from "react";

const clasesBotonIcono =
  "rounded-[var(--radius-base)] p-1.5 text-texto-suave hover:bg-fondo hover:text-texto disabled:opacity-50 disabled:pointer-events-none";

function obtenerDimensiones(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => resolve({ width: imagen.width, height: imagen.height });
    imagen.onerror = () => reject(new Error("No se pudo leer la imagen del ticket"));
    imagen.src = dataUrl;
  });
}

// Solo íconos acá a propósito (pedido explícito de Enzo, 2026-08-14):
// entre "Ver ticket", "Imprimir" y "Descargar" ya son varios botones
// juntos en pantalla, y con la palabra completa se sentía sobrecargado.
// html-to-image y jsPDF se importan recién al descargar, mismo criterio
// que exceljs en BotonExportarExcel.tsx — son librerías que pueden no
// usarse nunca en una visita. El PDF reusa la misma captura en PNG que
// ya se generaba (toPng) en vez de redibujar el ticket con la API de
// jsPDF: así no hay dos layouts del mismo comprobante para mantener
// sincronizados, y la página del PDF queda del mismo tamaño exacto que
// la imagen, sin cuentas de mm/DPI.
export function AccionesTicket({ numeroVenta }: { numeroVenta?: number }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [descargando, setDescargando] = useState<"png" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function nombreArchivo() {
    return numeroVenta ? `ticket-venta-${numeroVenta}` : `ticket-${Date.now()}`;
  }

  async function descargarPNG() {
    setMenuAbierto(false);
    const nodo = document.getElementById("ticket-imprimible");
    if (!nodo) return;

    setError(null);
    setDescargando("png");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(nodo, { pixelRatio: 2 });
      const enlace = document.createElement("a");
      enlace.href = dataUrl;
      enlace.download = `${nombreArchivo()}.png`;
      enlace.click();
    } catch {
      setError("No se pudo descargar la imagen. Probá de nuevo.");
    } finally {
      setDescargando(null);
    }
  }

  async function descargarPDF() {
    setMenuAbierto(false);
    const nodo = document.getElementById("ticket-imprimible");
    if (!nodo) return;

    setError(null);
    setDescargando("pdf");
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const dataUrl = await toPng(nodo, { pixelRatio: 2 });
      const { width, height } = await obtenerDimensiones(dataUrl);
      const pdf = new jsPDF({ unit: "px", format: [width, height] });
      pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
      pdf.save(`${nombreArchivo()}.pdf`);
    } catch {
      setError("No se pudo descargar el PDF. Probá de nuevo.");
    } finally {
      setDescargando(null);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => window.print()}
          title="Imprimir"
          aria-label="Imprimir ticket"
          className={clasesBotonIcono}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M6 9V2h12v7" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            disabled={descargando !== null}
            title="Descargar"
            aria-label="Descargar ticket"
            className={clasesBotonIcono}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M12 15V3" />
              <path d="m7 10 5 5 5-5" />
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            </svg>
          </button>

          {menuAbierto && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 flex w-36 flex-col overflow-hidden rounded-[var(--radius-base)] border border-linea bg-superficie shadow-lg">
                <button
                  type="button"
                  onClick={descargarPNG}
                  className="flex items-center gap-2 px-3 py-2 text-left text-xs text-texto hover:bg-fondo"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                  Imagen (PNG)
                </button>
                <button
                  type="button"
                  onClick={descargarPDF}
                  className="flex items-center gap-2 border-t border-linea px-3 py-2 text-left text-xs text-texto hover:bg-fondo"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  PDF
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-alerta">{error}</p>}
    </div>
  );
}
