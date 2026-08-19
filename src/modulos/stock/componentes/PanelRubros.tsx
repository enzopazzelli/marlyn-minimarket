"use client";

import { PanelListaSimple } from "@/componentes/PanelListaSimple";
import { useEsDueño } from "@/lib/supabase/PerfilContext";
import type { Categoria } from "../tipos";

// Alta/renombre/borrado de rubro es catálogo, dueño-only (Fase 5 de
// PLAN-ROLES-AUDITORIA.md) — la RLS de Fase 1 ya lo bloquea, esto
// evita mostrarle al operador un botón que le va a fallar al tocarlo.
export function PanelRubros({ categoriasIniciales }: { categoriasIniciales: Categoria[] }) {
  const esDueño = useEsDueño();
  if (!esDueño) return null;

  return (
    <PanelListaSimple
      tabla="categorias"
      titulo="Rubros"
      nombreSingular="rubro"
      itemsIniciales={categoriasIniciales}
    />
  );
}
