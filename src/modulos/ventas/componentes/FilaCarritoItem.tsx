"use client";

import { useState } from "react";
import type { Producto } from "@/modulos/stock/tipos";
import type { ItemCarrito } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

type UnidadPeso = Exclude<Producto["unidad"], "unidad">;

// El carrito guarda todo en kg/litro (lo que espera stock_actual,
// precio_venta y ventas_items.cantidad) — un cajero rara vez tipea un
// decimal como "0.250", así que el campo se muestra y edita en
// gramos/mililitros (enteros) y esta es la única capa que convierte.
const FACTOR: Record<UnidadPeso, number> = { kg: 1000, litro: 1000 };
const ETIQUETA_CHICA: Record<UnidadPeso, string> = { kg: "g", litro: "ml" };
const ETIQUETA_GRANDE: Record<UnidadPeso, string> = { kg: "/kg", litro: "/L" };

function redondearAGramos(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

// Al vender por monto ($1500 de jamón a $18000/kg = 83,333g) redondear
// al gramo cambiaba lo que efectivamente se cobraba (83g × $18000 =
// $1494, no $1500). cantidad ahora guarda hasta 6 decimales de kg
// (migración 20260824110000) — esto solo saca ruido de punto flotante,
// no redondea al gramo, para que cantidad × precio reconstruya el
// monto tipeado hasta el centavo.
function redondearFino(valor: number): number {
  return Math.round(valor * 1_000_000) / 1_000_000;
}

export function FilaCarritoItem({
  item,
  producto,
  onCambiarPaso,
  onCambiarCantidadExacta,
  onQuitar,
}: {
  item: ItemCarrito;
  producto: Producto | undefined;
  onCambiarPaso: (delta: number) => void;
  onCambiarCantidadExacta: (cantidad: number) => void;
  onQuitar: () => void;
}) {
  const unidad = producto?.unidad ?? "unidad";
  const esPeso = unidad === "kg" || unidad === "litro";
  const factor = esPeso ? FACTOR[unidad] : 1;

  // Estado propio para el texto tipeado: si el valor mostrado viniera
  // directo de item.cantidad, un "0." a mitad de tipeo se pisaría en
  // cada render (mismo problema que ya evita pagaCon/montoMixtoEfectivo
  // en PanelVentas.tsx). Al desmontarse esta fila (cambiar de pestaña
  // de venta, o sacar el producto) este estado se pierde solo.
  const [texto, setTexto] = useState(String(Math.round(item.cantidad * factor)));
  // Por peso también se puede cargar directo el monto ("$2.000 de
  // jamón" es más natural para un cajero que calcular los gramos a
  // mano) — los dos campos quedan relacionados: cambiar uno recalcula
  // el otro contra el mismo precio por kg/L.
  const [textoMonto, setTextoMonto] = useState(String(Math.round(item.cantidad * item.precioUnitario)));

  function alCambiarTexto(valor: string) {
    setTexto(valor);
    const numero = Number(valor);
    if (valor.trim() !== "" && Number.isFinite(numero) && numero >= 0) {
      const cantidad = esPeso ? redondearAGramos(numero / factor) : numero;
      onCambiarCantidadExacta(cantidad);
      if (esPeso) setTextoMonto(String(Math.round(cantidad * item.precioUnitario)));
    }
  }

  function alCambiarMonto(valor: string) {
    setTextoMonto(valor);
    const monto = Number(valor);
    if (valor.trim() !== "" && Number.isFinite(monto) && monto >= 0 && item.precioUnitario > 0) {
      // Sin redondear al gramo acá: la cantidad guarda la fracción real
      // (83,333g), así que cantidad × precio reconstruye el monto
      // tipeado hasta el centavo. El campo de gramos de al lado sigue
      // mostrando el valor redondeado a entero, solo para lectura.
      const cantidad = redondearFino(monto / item.precioUnitario);
      onCambiarCantidadExacta(cantidad);
      setTexto(String(Math.round(cantidad * factor)));
    }
  }

  // Red de seguridad: si por algún redondeo el campo de monto quedara
  // un centavo desalineado del total real, se resincroniza al salir
  // del campo (no en cada tecla, porque eso se autodestruiría a mitad
  // de tipeo — escribir el primer "1" ya redondearía a $0).
  function alSalirDeMonto() {
    if (item.precioUnitario > 0) setTextoMonto(String(Math.round(item.cantidad * item.precioUnitario)));
  }

  return (
    <div className="border-b border-linea px-4 py-2.5 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-texto">{item.nombre}</p>
          <p className="numero text-xs text-texto-suave">
            {platita.format(item.precioUnitario)} {esPeso ? ETIQUETA_GRANDE[unidad] : "c/u"}
          </p>
        </div>
        <p className="numero text-sm font-semibold text-texto">
          {platita.format(item.cantidad * item.precioUnitario)}
        </p>
      </div>

      {!esPeso ? (
        <div className="mt-1.5 flex items-center justify-end gap-1.5">
          <button
            type="button"
            aria-label="Quitar una unidad"
            onClick={() => onCambiarPaso(-1)}
            className="numero h-6 w-6 rounded border border-linea text-sm hover:bg-fondo"
          >
            −
          </button>
          <span className="numero min-w-[20px] text-center text-sm">{item.cantidad}</span>
          <button
            type="button"
            aria-label="Sumar una unidad"
            onClick={() => onCambiarPaso(1)}
            className="numero h-6 w-6 rounded border border-linea text-sm hover:bg-fondo"
          >
            +
          </button>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onQuitar}
            className="text-xs text-texto-suave underline decoration-dotted underline-offset-2 hover:text-alerta"
          >
            Quitar
          </button>
          <span className="numero text-xs text-texto-suave">$</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="1"
            aria-label={`Monto de ${item.nombre}`}
            value={textoMonto}
            onChange={(evento) => alCambiarMonto(evento.target.value)}
            onFocus={(evento) => evento.currentTarget.select()}
            onBlur={alSalirDeMonto}
            className="numero w-20 rounded border border-linea px-2 py-1 text-right text-sm outline-none focus-visible:border-acento"
          />
          <span className="text-xs text-texto-suave">o</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step="1"
            aria-label={`Cantidad de ${item.nombre} en ${ETIQUETA_CHICA[unidad]}`}
            value={texto}
            onChange={(evento) => alCambiarTexto(evento.target.value)}
            onFocus={(evento) => evento.currentTarget.select()}
            className="numero w-20 rounded border border-linea px-2 py-1 text-right text-sm outline-none focus-visible:border-acento"
          />
          <span className="numero text-xs text-texto-suave">{ETIQUETA_CHICA[unidad]}</span>
        </div>
      )}
    </div>
  );
}
