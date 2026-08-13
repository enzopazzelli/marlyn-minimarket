import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cliente, MovimientoCuentaCorriente } from "../tipos";

type FilaCliente = {
  id: string;
  nombre: string;
  telefono: string | null;
  direccion: string | null;
  saldo_cuenta_corriente: number | string;
};

export async function listarClientes(supabase: SupabaseClient): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nombre, telefono, direccion, saldo_cuenta_corriente")
    .order("nombre", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as FilaCliente[]).map((fila) => ({
    id: fila.id,
    nombre: fila.nombre,
    telefono: fila.telefono,
    direccion: fila.direccion,
    saldoCuentaCorriente: Number(fila.saldo_cuenta_corriente),
  }));
}

export type ItemVentaFiada = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

export type MovimientoCuentaCorrienteDetallado = MovimientoCuentaCorriente & {
  ventaNumero: number | null;
  items: ItemVentaFiada[];
};

type FilaMovimiento = {
  id: string;
  cliente_id: string;
  venta_id: string | null;
  tipo: MovimientoCuentaCorriente["tipo"];
  monto: number | string;
  nota: string | null;
  creado_en: string;
  ventas: {
    numero: number;
    ventas_items: {
      cantidad: number | string;
      precio_unitario: number | string;
      productos: { nombre: string } | null;
    }[];
  } | null;
};

// Para cada movimiento de tipo 'fiado' trae los productos de la venta
// que lo originó (fecha/producto/precio), tal como pidió el cliente
// para poder decidir el % de recargo con la info completa a la vista.
export async function listarMovimientosCuentaCorriente(
  supabase: SupabaseClient,
  clienteId: string,
): Promise<MovimientoCuentaCorrienteDetallado[]> {
  const { data, error } = await supabase
    .from("movimientos_cuenta_corriente")
    .select(
      "id, cliente_id, venta_id, tipo, monto, nota, creado_en, ventas(numero, ventas_items(cantidad, precio_unitario, productos(nombre)))",
    )
    .eq("cliente_id", clienteId)
    .order("creado_en", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as unknown as FilaMovimiento[]).map((fila) => ({
    id: fila.id,
    clienteId: fila.cliente_id,
    ventaId: fila.venta_id,
    tipo: fila.tipo,
    monto: Number(fila.monto),
    nota: fila.nota,
    creadoEn: fila.creado_en,
    ventaNumero: fila.ventas?.numero ?? null,
    items: (fila.ventas?.ventas_items ?? []).map((item) => ({
      nombre: item.productos?.nombre ?? "Producto eliminado",
      cantidad: Number(item.cantidad),
      precioUnitario: Number(item.precio_unitario),
    })),
  }));
}
