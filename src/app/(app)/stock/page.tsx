import { BarraSuperior } from "@/componentes/BarraSuperior";
import { EstadoVacio } from "@/componentes/EstadoVacio";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { listarCategorias, listarProductos } from "@/modulos/stock/consultas/productos";
import { FormularioNuevoProducto } from "@/modulos/stock/componentes/FormularioNuevoProducto";
import { ListaProductos } from "@/modulos/stock/componentes/ListaProductos";
import { PanelRubros } from "@/modulos/stock/componentes/PanelRubros";

export default async function PaginaStock() {
  const supabase = await crearClienteServidor();
  const [productos, categorias] = await Promise.all([
    listarProductos(supabase),
    listarCategorias(supabase),
  ]);

  return (
    <>
      <BarraSuperior titulo="Stock">
        <div className="flex items-center gap-2">
          <PanelRubros categoriasIniciales={categorias} />
          <FormularioNuevoProducto categoriasIniciales={categorias} />
        </div>
      </BarraSuperior>
      <main className="flex-1 p-4 md:p-6">
        {productos.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no cargaste ningún producto"
            descripcion="Ingresá mercadería con su precio, código de barras y stock mínimo para empezar a vender."
          />
        ) : (
          <ListaProductos productos={productos} categorias={categorias} />
        )}
      </main>
    </>
  );
}
