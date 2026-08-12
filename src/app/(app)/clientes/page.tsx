import { BarraSuperior } from "@/componentes/BarraSuperior";
import { EstadoVacio } from "@/componentes/EstadoVacio";

export default function PaginaClientes() {
  return (
    <>
      <BarraSuperior titulo="Clientes" />
      <main className="flex-1 p-4 md:p-6">
        <EstadoVacio
          titulo="Todavía no cargaste ningún cliente"
          descripcion="Sumá una ficha para poder vender fiado y llevarle la cuenta corriente."
        />
      </main>
    </>
  );
}
