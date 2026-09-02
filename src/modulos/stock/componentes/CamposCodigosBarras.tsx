"use client";

import { useState } from "react";
import { Campo } from "@/componentes/Campo";
import { MAXIMO_CODIGOS_ADICIONALES } from "../consultas/codigosBarras";

// Pedido del dueño (2026-09-02): *"haceme una opción donde capaz haga
// clic en el código de barras y se me abra 1, 2, 3, 4, 5, 6 códigos de
// barra más"*. Arranca plegado —el 90% de los productos tiene uno
// solo— y se despliega con un click; si el producto ya tiene
// adicionales cargados, arranca abierto para que se vean sin buscarlos.
//
// Compartido por el alta y la edición, que antes tenían cada una su
// propio <Campo> de código.
export function CamposCodigosBarras({
  idPrefijo,
  principal,
  adicionales,
  onPrincipal,
  onAdicionales,
}: {
  /** Para que los id/htmlFor no choquen cuando hay dos formularios en
   *  la misma página (la lista de Stock monta uno de edición por fila). */
  idPrefijo: string;
  principal: string;
  adicionales: string[];
  onPrincipal: (valor: string) => void;
  onAdicionales: (valores: string[]) => void;
}) {
  const [desplegado, setDesplegado] = useState(adicionales.some((codigo) => codigo.trim() !== ""));

  function cambiarAdicional(indice: number, valor: string) {
    const siguiente = [...adicionales];
    siguiente[indice] = valor;
    onAdicionales(siguiente);
  }

  const cargados = adicionales.filter((codigo) => codigo.trim() !== "").length;

  return (
    <div className="flex flex-col gap-2">
      <Campo
        etiqueta="Código de barras (opcional)"
        id={`${idPrefijo}-codigoBarras`}
        value={principal}
        onChange={(evento) => onPrincipal(evento.target.value)}
        className="font-[family-name:var(--font-numero)]"
      />

      {!desplegado ? (
        <button
          type="button"
          onClick={() => setDesplegado(true)}
          className="self-start text-xs font-medium text-texto-suave underline decoration-dotted underline-offset-2 hover:text-texto"
        >
          + Otros códigos para este producto
          {cargados > 0 ? ` (${cargados} cargados)` : ` (hasta ${MAXIMO_CODIGOS_ADICIONALES} más)`}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-[var(--radius-base)] border border-linea p-3">
          <p className="text-xs text-texto-suave">
            Otros códigos que tienen que caer en <strong>este mismo producto</strong> al escanear: variantes
            que van al mismo precio (por ejemplo las salsas listas), o el código nuevo cuando el fabricante lo
            cambia y todavía queda mercadería con el viejo.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: MAXIMO_CODIGOS_ADICIONALES }, (_, indice) => (
              <Campo
                key={indice}
                etiqueta={`Código ${indice + 2}`}
                id={`${idPrefijo}-codigoAdicional-${indice}`}
                value={adicionales[indice] ?? ""}
                onChange={(evento) => cambiarAdicional(indice, evento.target.value)}
                className="font-[family-name:var(--font-numero)]"
              />
            ))}
          </div>
          <p className="text-xs text-texto-suave">
            Ojo: al ser un solo producto, comparten stock y salen con el mismo nombre en el ticket.
          </p>
        </div>
      )}
    </div>
  );
}

/** Las 5 casillas siempre existen en el estado del formulario, aunque
 *  estén vacías: así el índice de cada una es estable y no hace falta
 *  reordenar nada cuando se borra una del medio. */
export function casillasVacias(): string[] {
  return Array.from({ length: MAXIMO_CODIGOS_ADICIONALES }, () => "");
}

/** Rellena hasta 5 con lo que ya tiene el producto. */
export function casillasDesde(codigos: string[]): string[] {
  const casillas = casillasVacias();
  codigos.slice(0, MAXIMO_CODIGOS_ADICIONALES).forEach((codigo, indice) => {
    casillas[indice] = codigo;
  });
  return casillas;
}
