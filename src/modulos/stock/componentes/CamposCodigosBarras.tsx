"use client";

import { useState } from "react";
import { Campo } from "@/componentes/Campo";
import { MAXIMO_CODIGOS_ADICIONALES } from "../consultas/codigosBarras";

// Pedido del dueño (2026-09-02): *"haceme una opción donde capaz haga
// clic en el código de barras y se me abra 1, 2, 3, 4, 5, 6 códigos de
// barra más"*. Después subió el tope a 20 por producto.
//
// Con 19 adicionales ya no sirve mostrar todas las casillas juntas: se
// muestran las que tienen algo cargado más una vacía, y se van sumando
// de a una con "+ Agregar otro código". Arranca plegado —la enorme
// mayoría de los productos tiene un solo código— y se despliega con un
// click; si el producto ya tiene adicionales, arranca abierto.
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

  const cargados = adicionales.filter((codigo) => codigo.trim() !== "").length;

  function cambiar(indice: number, valor: string) {
    const siguiente = [...adicionales];
    siguiente[indice] = valor;
    onAdicionales(siguiente);
  }

  function quitar(indice: number) {
    const siguiente = adicionales.filter((_, i) => i !== indice);
    onAdicionales(siguiente.length > 0 ? siguiente : [""]);
  }

  function agregar() {
    if (adicionales.length >= MAXIMO_CODIGOS_ADICIONALES) return;
    onAdicionales([...adicionales, ""]);
  }

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
            Otros códigos que tienen que caer en <strong>este mismo producto</strong> al escanear: variantes que
            van al mismo precio (por ejemplo las salsas listas), o el código nuevo cuando el fabricante lo cambia
            y todavía queda mercadería con el viejo.
          </p>

          <div className="flex flex-col gap-2">
            {adicionales.map((codigo, indice) => (
              <div key={indice} className="flex items-end gap-2">
                <div className="flex-1">
                  <Campo
                    etiqueta={`Código ${indice + 2}`}
                    id={`${idPrefijo}-codigoAdicional-${indice}`}
                    value={codigo}
                    onChange={(evento) => cambiar(indice, evento.target.value)}
                    className="font-[family-name:var(--font-numero)]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => quitar(indice)}
                  aria-label={`Quitar código ${indice + 2}`}
                  className="mb-1.5 rounded-[var(--radius-base)] border border-linea px-2 py-1.5 text-xs text-texto-suave hover:border-alerta hover:text-alerta"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={agregar}
              disabled={adicionales.length >= MAXIMO_CODIGOS_ADICIONALES}
              className="text-xs font-medium text-texto-suave underline decoration-dotted underline-offset-2 hover:text-texto disabled:no-underline disabled:opacity-50"
            >
              + Agregar otro código
            </button>
            <span className="numero text-xs text-texto-suave">
              {cargados + 1} de {MAXIMO_CODIGOS_ADICIONALES + 1}
            </span>
          </div>

          <p className="text-xs text-texto-suave">
            Ojo: al ser un solo producto, comparten stock y salen con el mismo nombre en el ticket.
          </p>
        </div>
      )}
    </div>
  );
}

/** El formulario arranca con una casilla vacía; las demás se agregan a
 *  mano. Con tope 20 ya no tiene sentido tener todas las casillas
 *  creadas de entrada. */
export function casillasVacias(): string[] {
  return [""];
}

/** Los códigos que ya tiene el producto, más nada: si no tiene ninguno,
 *  una casilla vacía para poder empezar a escribir. */
export function casillasDesde(codigos: string[]): string[] {
  return codigos.length > 0 ? [...codigos] : [""];
}
