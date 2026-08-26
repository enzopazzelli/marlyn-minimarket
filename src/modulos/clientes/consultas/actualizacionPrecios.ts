import type { SupabaseClient } from "@supabase/supabase-js";

/** Una línea de la comparación "precio al que lo sacó" vs "precio de
 *  hoy", para un producto de un fiado todavía abierto. La arma
 *  `calcular_actualizacion_precios_fiado()` en la base — acá no se
 *  recalcula nada, solo se pasa a camelCase. */
export type FilaComparacionPrecio = {
  ventaId: string;
  ventaNumero: number;
  fiadoEn: string;
  productoId: string;
  producto: string;
  cantidad: number;
  /** El precio del que se parte: el de la venta, o el que dejó la
   *  última actualización que cobró este producto. */
  precioBase: number;
  precioActual: number;
  /** < 1 solo en ventas mixtas, donde parte se pagó en el momento. */
  proporcionFiada: number;
  /** Ya viene con la proporción aplicada. Negativa si el precio bajó. */
  diferencia: number;
};

type FilaCruda = {
  venta_id: string;
  venta_numero: number | string;
  fiado_en: string;
  producto_id: string;
  producto: string;
  cantidad: number | string;
  precio_base: number | string;
  precio_actual: number | string;
  proporcion_fiada: number | string;
  diferencia: number | string;
};

export async function calcularActualizacionPrecios(
  supabase: SupabaseClient,
  clienteId: string,
): Promise<FilaComparacionPrecio[]> {
  const { data, error } = await supabase.rpc("calcular_actualizacion_precios_fiado", {
    p_cliente_id: clienteId,
  });

  if (error) throw error;

  return ((data ?? []) as FilaCruda[]).map((fila) => ({
    ventaId: fila.venta_id,
    ventaNumero: Number(fila.venta_numero),
    fiadoEn: fila.fiado_en,
    productoId: fila.producto_id,
    producto: fila.producto,
    cantidad: Number(fila.cantidad),
    precioBase: Number(fila.precio_base),
    precioActual: Number(fila.precio_actual),
    proporcionFiada: Number(fila.proporcion_fiada),
    diferencia: Number(fila.diferencia),
  }));
}

/** Devuelve el monto que se sumó al saldo. El total lo recalcula la
 *  base al aplicar (no se manda desde acá), así que si el precio de
 *  algo cambió entre la vista previa y el click, se cobra lo correcto. */
export async function registrarActualizacionPrecios(
  supabase: SupabaseClient,
  clienteId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("registrar_actualizacion_precios_fiado", {
    p_cliente_id: clienteId,
  });

  if (error) throw error;
  return Number(data);
}

export type ResumenActualizacion = {
  productosQueSubieron: number;
  productosQueBajaron: number;
  productosSinCambio: number;
  /** Lo que se le suma a la cuenta: solo las subas (decidido con el
   *  cliente — un producto que bajó no descuenta). */
  totalAAplicar: number;
  /** Lo que costaría la misma mercadería a precio de hoy, contando
   *  también las bajas. Informativo, para que el Excel muestre las dos
   *  puntas y se vea por qué no coinciden. */
  totalNetoAPrecioDeHoy: number;
};

/** Pura, sin Supabase: el mismo resumen lo muestran la pantalla y el
 *  Excel de comparación. */
export function resumirActualizacion(filas: FilaComparacionPrecio[]): ResumenActualizacion {
  const redondear = (valor: number) => Math.round(valor * 100) / 100;

  return {
    productosQueSubieron: filas.filter((fila) => fila.diferencia > 0).length,
    productosQueBajaron: filas.filter((fila) => fila.diferencia < 0).length,
    productosSinCambio: filas.filter((fila) => fila.diferencia === 0).length,
    totalAAplicar: redondear(
      filas.reduce((total, fila) => (fila.diferencia > 0 ? total + fila.diferencia : total), 0),
    ),
    totalNetoAPrecioDeHoy: redondear(filas.reduce((total, fila) => total + fila.diferencia, 0)),
  };
}
