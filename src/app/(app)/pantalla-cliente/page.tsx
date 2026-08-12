import { BarraSuperior } from "@/componentes/BarraSuperior";
import { EstadoVacio } from "@/componentes/EstadoVacio";

export default function PaginaPantallaCliente() {
  return (
    <>
      <BarraSuperior titulo="Pantalla al cliente" />
      <main className="flex-1 p-4 md:p-6">
        <EstadoVacio
          titulo="Todavía no emparejaste ninguna pantalla"
          descripcion="Acá vas a generar el código para abrir la vista de solo lectura en la TV del mostrador, sin compartir tu sesión de operador."
        />
      </main>
    </>
  );
}
