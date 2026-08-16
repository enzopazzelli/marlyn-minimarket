"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Portalea su contenido fuera del árbol normal de la app (Modal
// incluido) para colgarlo directo de <body>, en flujo normal de
// documento — necesario para que el motor de impresión pueda partir
// el contenido en varias páginas de verdad. Encontrado con las
// etiquetas de góndola (EtiquetasProductos.tsx): el truco anterior
// (aislar con visibility:hidden + position:fixed/inset:0) solo sirve
// para algo que entra en una sola página — un elemento fuera de flujo
// no se pagina, lo que no entra se recorta o se pierde en vez de
// seguir en la hoja siguiente. Oculto en pantalla por default
// (`.capa-impresion` en globals.css), visible solo dentro de
// `@media print`.
export function CapaImpresion({ id, children }: { id: string; children: ReactNode }) {
  // El nodo se crea en el inicializador perezoso de useState (no en el
  // efecto) para no terminar llamando setState desde dentro de un
  // efecto — el efecto de abajo solo lo cuelga de <body> y lo saca al
  // desmontar, un side effect de DOM sin tocar estado de React.
  const [contenedor] = useState<HTMLDivElement | null>(() => {
    if (typeof document === "undefined") return null;
    const nodo = document.createElement("div");
    nodo.id = id;
    nodo.className = "capa-impresion";
    return nodo;
  });

  useEffect(() => {
    if (!contenedor) return;
    document.body.appendChild(contenedor);
    return () => {
      document.body.removeChild(contenedor);
    };
  }, [contenedor]);

  if (!contenedor) return null;
  return createPortal(children, contenedor);
}
