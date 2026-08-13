import { PanelListaSimple } from "@/componentes/PanelListaSimple";
import type { Categoria } from "../tipos";

export function PanelRubros({ categoriasIniciales }: { categoriasIniciales: Categoria[] }) {
  return (
    <PanelListaSimple
      tabla="categorias"
      titulo="Rubros"
      nombreSingular="rubro"
      itemsIniciales={categoriasIniciales}
    />
  );
}
