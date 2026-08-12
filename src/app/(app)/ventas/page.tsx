import { BarraSuperior } from "@/componentes/BarraSuperior";
import { EstadoVacio } from "@/componentes/EstadoVacio";

export default function PaginaVentas() {
  return (
    <>
      <BarraSuperior titulo="Ventas" />
      <main className="flex-1 p-4 md:p-6">
        <EstadoVacio
          titulo="El punto de venta todavía no está armado"
          descripcion="Acá va a vivir el carrito, el lector con foco fijo y el cobro con pago simple o mixto."
        />
      </main>
    </>
  );
}
