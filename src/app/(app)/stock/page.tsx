import { BarraSuperior } from "@/componentes/BarraSuperior";
import { EstadoVacio } from "@/componentes/EstadoVacio";

export default function PaginaStock() {
  return (
    <>
      <BarraSuperior titulo="Stock" />
      <main className="flex-1 p-4 md:p-6">
        <EstadoVacio
          titulo="Todavía no cargaste ningún producto"
          descripcion="Ingresá mercadería con su precio, código de barras y stock mínimo para empezar a vender."
        />
      </main>
    </>
  );
}
