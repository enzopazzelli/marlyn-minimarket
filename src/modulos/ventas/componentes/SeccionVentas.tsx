"use client";

import { useState } from "react";
import type { Cliente } from "@/modulos/clientes/tipos";
import type { Producto } from "@/modulos/stock/tipos";
import type { VentaResumen } from "../consultas/ventas";
import { ListaVentasDelTurno } from "./ListaVentasDelTurno";
import { PanelVentas } from "./PanelVentas";

// Productos y ventas del turno se liftean acá (en vez de que cada uno
// dependa de su propio fetch del servidor) para que confirmar una
// venta pueda actualizar los dos de forma optimista — sin el
// router.refresh() que antes repetía la carga completa del catálogo
// (~2991 productos) en la acción más frecuente de todo el sistema.
export function SeccionVentas({
  productosIniciales,
  clientes,
  turnoCajaId,
  usuarioId,
  tokenPantalla,
  ventasIniciales,
}: {
  productosIniciales: Producto[];
  clientes: Cliente[];
  turnoCajaId: string;
  usuarioId: string;
  tokenPantalla: string;
  ventasIniciales: VentaResumen[];
}) {
  // "Adjusting state when a prop changes" (react.dev) — mismo patrón
  // que ya usa PanelVentas para clientes. BotonAnularVenta sigue
  // haciendo router.refresh() al anular una venta (acción rara, no
  // hace falta optimizarla); cuando eso reejecuta el server component
  // de /ventas, las props llegan con arrays nuevos y tienen que pisar
  // el estado optimista de acá, no quedarse atrás.
  const [productosVistos, setProductosVistos] = useState(productosIniciales);
  const [productos, setProductos] = useState(productosIniciales);
  if (productosIniciales !== productosVistos) {
    setProductosVistos(productosIniciales);
    setProductos(productosIniciales);
  }

  const [ventasVistas, setVentasVistas] = useState(ventasIniciales);
  const [ventas, setVentas] = useState(ventasIniciales);
  if (ventasIniciales !== ventasVistas) {
    setVentasVistas(ventasIniciales);
    setVentas(ventasIniciales);
  }

  function alConfirmarVenta(venta: VentaResumen, items: { productoId: string; cantidad: number }[]) {
    setProductos((anteriores) =>
      anteriores.map((producto) => {
        const item = items.find((i) => i.productoId === producto.id);
        return item ? { ...producto, stockActual: producto.stockActual - item.cantidad } : producto;
      }),
    );
    setVentas((anteriores) => [venta, ...anteriores]);
  }

  return (
    <div className="flex flex-col gap-4">
      <PanelVentas
        productos={productos}
        clientes={clientes}
        turnoCajaId={turnoCajaId}
        usuarioId={usuarioId}
        tokenPantalla={tokenPantalla}
        onVentaConfirmada={alConfirmarVenta}
      />
      <ListaVentasDelTurno ventas={ventas} />
    </div>
  );
}
