import { BarraSuperior } from "@/componentes/BarraSuperior";
import { EstadoVacio } from "@/componentes/EstadoVacio";

export default function PaginaCaja() {
  return (
    <>
      <BarraSuperior titulo="Caja" />
      <main className="flex-1 p-4 md:p-6">
        <EstadoVacio
          titulo="Todavía no hay ningún turno abierto"
          descripcion="Acá se abre y se cierra la caja del día, con el arqueo y la diferencia calculada."
        />
      </main>
    </>
  );
}
