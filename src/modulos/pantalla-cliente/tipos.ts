/** Lo que transmite la terminal de venta y lo que dibuja la TV. Nunca
 *  expone historial, costos ni datos de clientes — solo lo que está
 *  pasando en el mostrador ahora mismo (prompt-base sección 2.1). */
export type EstadoPantallaCliente =
  | { tipo: "espera" }
  | {
      tipo: "venta-en-curso";
      items: Array<{ nombre: string; cantidad: number; precioUnitario: number }>;
      total: number;
    }
  | { tipo: "venta-cobrada"; total: number };
