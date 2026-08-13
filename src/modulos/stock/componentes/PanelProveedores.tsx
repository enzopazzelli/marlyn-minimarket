import { PanelListaSimple } from "@/componentes/PanelListaSimple";
import type { Proveedor } from "../tipos";

export function PanelProveedores({ proveedoresIniciales }: { proveedoresIniciales: Proveedor[] }) {
  return (
    <PanelListaSimple
      tabla="proveedores"
      titulo="Proveedores"
      nombreSingular="proveedor"
      itemsIniciales={proveedoresIniciales}
    />
  );
}
