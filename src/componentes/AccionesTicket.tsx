"use client";

import { useState } from "react";
import { guardarAnchoRollo, reglaPaginaTicket, useAnchoRollo, type AnchoRollo } from "@/lib/rolloTicket";

const clasesBotonIcono =
  "rounded-[var(--radius-base)] p-1.5 text-texto-suave hover:bg-fondo hover:text-texto disabled:opacity-50 disabled:pointer-events-none";

const ANCHOS_ROLLO: AnchoRollo[] = [58, 80];

function obtenerDimensiones(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const imagen = new Image();
    imagen.onload = () => resolve({ width: imagen.width, height: imagen.height });
    imagen.onerror = () => reject(new Error("No se pudo leer la imagen del ticket"));
    imagen.src = dataUrl;
  });
}

// La copia de impresión (#ticket-imprimible, portaleada por
// CapaImpresion) está con display:none en pantalla, y ahí mide 0×0:
// html-to-image devolvía una imagen vacía — el PNG bajaba como un
// archivo de 0 bytes y el PDF fallaba — y tampoco hay alto para armar
// la página. Mientras dura `accion`, la capa se dibuja fuera de la
// pantalla (.fuera-de-pantalla en globals.css) con su tamaño real.
async function conTicketFueraDePantalla<T>(accion: (nodo: HTMLElement) => T | Promise<T>): Promise<T | null> {
  const nodo = document.getElementById("ticket-imprimible");
  const capa = nodo?.closest(".capa-impresion");
  if (!nodo || !capa) return null;

  capa.classList.add("fuera-de-pantalla");
  try {
    return await accion(nodo);
  } finally {
    capa.classList.remove("fuera-de-pantalla");
  }
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
//
// El engranaje elige el ancho del rollo de la térmica (58 u 80 mm,
// pedido de Enzo, 2026-09-22): se configura una vez por PC y queda
// guardado, por eso va escondido en un menú y no a la vista.
export function AccionesTicket({ numeroVenta }: { numeroVenta?: number }) {
  const [menuAbierto, setMenuAbierto] = useState<"descargar" | "rollo" | null>(null);
  const [descargando, setDescargando] = useState<"png" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const anchoRollo = useAnchoRollo();

  function nombreArchivo() {
    return numeroVenta ? `ticket-venta-${numeroVenta}` : `ticket-${Date.now()}`;
  }

  function alternarMenu(menu: "descargar" | "rollo") {
    setMenuAbierto((abierto) => (abierto === menu ? null : menu));
  }

  function elegirRollo(ancho: AnchoRollo) {
    setMenuAbierto(null);
    guardarAnchoRollo(ancho);
  }

  // La página se arma con el ancho del rollo y el alto medido del
  // ticket (ver reglaPaginaTicket), y se saca al terminar para no pisar
  // otras impresiones de la app.
  async function imprimir() {
    const alto = await conTicketFueraDePantalla((nodo) => nodo.getBoundingClientRect().height);
    if (alto) {
      const estiloPagina = document.createElement("style");
      estiloPagina.textContent = reglaPaginaTicket(anchoRollo, alto);
      document.head.appendChild(estiloPagina);
      window.addEventListener("afterprint", () => estiloPagina.remove(), { once: true });
    }
    window.print();
  }

  async function descargarPNG() {
    setMenuAbierto(null);
    setError(null);
    setDescargando("png");
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await conTicketFueraDePantalla((nodo) => toPng(nodo, { pixelRatio: 2 }));
      if (!dataUrl) return;
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
    setMenuAbierto(null);
    setError(null);
    setDescargando("pdf");
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const dataUrl = await conTicketFueraDePantalla((nodo) => toPng(nodo, { pixelRatio: 2 }));
      if (!dataUrl) return;
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
        {menuAbierto && <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(null)} />}

        <button
          type="button"
          onClick={imprimir}
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
            onClick={() => alternarMenu("descargar")}
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

          {menuAbierto === "descargar" && (
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
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => alternarMenu("rollo")}
            title={`Rollo de ${anchoRollo} mm`}
            aria-label="Elegir ancho del rollo de la impresora"
            className={clasesBotonIcono}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>

          {menuAbierto === "rollo" && (
            <div className="absolute right-0 top-full z-20 mt-1 flex w-40 flex-col overflow-hidden rounded-[var(--radius-base)] border border-linea bg-superficie shadow-lg">
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-texto-suave">Rollo de la impresora</p>
              {ANCHOS_ROLLO.map((ancho) => (
                <button
                  key={ancho}
                  type="button"
                  onClick={() => elegirRollo(ancho)}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-left text-xs text-texto hover:bg-fondo"
                >
                  {ancho} mm
                  {ancho === anchoRollo && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-ok">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-alerta">{error}</p>}
    </div>
  );
}
