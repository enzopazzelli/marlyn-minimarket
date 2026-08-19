"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Perfil } from "./perfil";

const PerfilContext = createContext<Perfil | null>(null);

// Sembrado una vez en (app)/layout.tsx (Server Component, ya trae el
// perfil para BarraLateral) para que cualquier Client Component de
// abajo pueda preguntar el rol sin que cada página intermedia tenga que
// recibirlo y volver a pasarlo a mano — Fase 5 de
// PLAN-ROLES-AUDITORIA.md toca botones repartidos en Stock, Clientes,
// Caja y Proveedores, prop-drilling ahí sería más ruido que esto.
export function PerfilProvider({ perfil, children }: { perfil: Perfil; children: ReactNode }) {
  return <PerfilContext.Provider value={perfil}>{children}</PerfilContext.Provider>;
}

export function usePerfil(): Perfil {
  const perfil = useContext(PerfilContext);
  if (!perfil) throw new Error("usePerfil() usado fuera de <PerfilProvider>");
  return perfil;
}

// La barrera real para todo lo que gatea este hook ya es la RLS (Fase
// 1) — esto es solo para no mostrar un botón que va a fallar al
// tocarlo. Nunca al revés: no hay ninguna acción que dependa de esto
// para estar realmente protegida.
export function useEsDueño(): boolean {
  return usePerfil().rol === "dueño";
}
