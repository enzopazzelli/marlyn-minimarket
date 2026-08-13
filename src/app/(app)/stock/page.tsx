import { BarraSuperior } from "@/componentes/BarraSuperior";
import { EstadoVacio } from "@/componentes/EstadoVacio";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { listarCategorias, listarProductos } from "@/modulos/stock/consultas/productos";
import { listarProveedores } from "@/modulos/proveedores/consultas/proveedores";
import { FormularioImportarExcel } from "@/modulos/stock/componentes/FormularioImportarExcel";
import { FormularioNuevoProducto } from "@/modulos/stock/componentes/FormularioNuevoProducto";
import { ListaProductos } from "@/modulos/stock/componentes/ListaProductos";
import { PanelRubros } from "@/modulos/stock/componentes/PanelRubros";
import { PanelProveedores } from "@/modulos/stock/componentes/PanelProveedores";

export default async function PaginaStock() {
  const supabase = await crearClienteServidor();
  const [productos, categorias, proveedores] = await Promise.all([
    listarProductos(supabase),
    listarCategorias(supabase),
    listarProveedores(supabase),
  ]);

  return (
    <>
      <BarraSuperior titulo="Stock">
        <div className="flex items-center gap-2">
          <PanelRubros categoriasIniciales={categorias} />
          <PanelProveedores proveedoresIniciales={proveedores} />
          <FormularioImportarExcel categorias={categorias} proveedores={proveedores} productos={productos} />
          <FormularioNuevoProducto categoriasIniciales={categorias} proveedoresIniciales={proveedores} />
        </div>
      </BarraSuperior>
      <main className="flex-1 p-4 md:p-6">
        {productos.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no cargaste ningún producto"
            descripcion="Ingresá mercadería con su precio, código de barras y stock mínimo para empezar a vender."
          />
        ) : (
          <ListaProductos productos={productos} categorias={categorias} proveedores={proveedores} />
        )}
      </main>
    </>
  );
}
