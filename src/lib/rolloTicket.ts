import { useSyncExternalStore } from "react";

/** Ancho del rollo de la impresora térmica de tickets. La del local
 *  (IT03, ESC/POS por USB) acepta los dos anchos según qué papel se le
 *  cargue, así que se elige desde el ticket mismo (pedido de Enzo,
 *  2026-09-22). Se guarda en localStorage y no en la base: el rollo es
 *  de la impresora enchufada a ESA PC, no del comercio entero — otra
 *  máquina puede tener otra impresora, o ninguna. */
export type AnchoRollo = 58 | 80;

export const ANCHO_ROLLO_POR_DEFECTO: AnchoRollo = 80;

const CLAVE = "marlyn:ancho-rollo-ticket";
const EVENTO = "ancho-rollo-ticket";

export function leerAnchoRollo(): AnchoRollo {
  try {
    const guardado = window.localStorage.getItem(CLAVE);
    return guardado === "58" ? 58 : guardado === "80" ? 80 : ANCHO_ROLLO_POR_DEFECTO;
  } catch {
    return ANCHO_ROLLO_POR_DEFECTO;
  }
}

export function guardarAnchoRollo(ancho: AnchoRollo) {
  try {
    window.localStorage.setItem(CLAVE, String(ancho));
  } catch {
    // Sin localStorage (navegación privada con el almacenamiento
    // bloqueado) la elección dura solo lo que dure la pestaña: igual se
    // avisa abajo para que el ticket abierto se acomode.
  }
  window.dispatchEvent(new Event(EVENTO));
}

function suscribir(alCambiar: () => void) {
  window.addEventListener(EVENTO, alCambiar);
  // "storage" llega cuando se cambia desde OTRA pestaña (Ventas y
  // Reportes abiertas a la vez, por ejemplo).
  window.addEventListener("storage", alCambiar);
  return () => {
    window.removeEventListener(EVENTO, alCambiar);
    window.removeEventListener("storage", alCambiar);
  };
}

export function useAnchoRollo(): AnchoRollo {
  return useSyncExternalStore(suscribir, leerAnchoRollo, () => ANCHO_ROLLO_POR_DEFECTO);
}

/** El papel no se imprime de borde a borde: el cabezal de una térmica
 *  de 80 mm cubre 72 mm (576 puntos a 203 dpi) y el de una de 58 mm,
 *  48 mm (384 puntos). El margen lateral del ticket es lo que sobra de
 *  cada lado, para que nada quede en la zona que el cabezal no alcanza. */
export function medidasRollo(ancho: AnchoRollo) {
  const imprimibleMm = ancho === 80 ? 72 : 48;
  return { anchoMm: ancho, margenMm: (ancho - imprimibleMm) / 2 };
}

/** `@page` con el tamaño exacto del ticket, armado justo antes de
 *  imprimir: el alto depende de cuántos productos tiene la venta, y CSS
 *  no tiene forma válida de decir "alto = contenido" (`size: 80mm auto`,
 *  lo que había antes, es inválido y Chrome lo descartaba entero,
 *  imprimiendo en hoja Carta). El alto se redondea para arriba: medio
 *  mm de menos alcanza para mandar la última línea a una segunda hoja,
 *  que la térmica imprimiría y cortaría aparte. */
export function reglaPaginaTicket(anchoMm: number, altoPx: number) {
  const altoMm = Math.ceil((altoPx * 25.4) / 96);
  return `@page { size: ${anchoMm}mm ${altoMm}mm; margin: 0; }`;
}
