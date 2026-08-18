"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";

// No existía ningún botón de logout en toda la app (siempre hubo un
// solo usuario compartido). Con dos roles usando la misma PC del
// mostrador deja de ser cosmético: si nadie cierra sesión, el empleado
// nunca entra con su propio usuario y la auditoría queda vacía.
export function BotonCerrarSesion() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function cerrarSesion() {
    setSaliendo(true);
    const supabase = crearClienteNavegador();
    await supabase.auth.signOut();
    router.replace("/ingresar");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={cerrarSesion}
      disabled={saliendo}
      className="text-left text-xs text-white/50 underline decoration-dotted underline-offset-2 hover:text-white disabled:opacity-50"
    >
      {saliendo ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
