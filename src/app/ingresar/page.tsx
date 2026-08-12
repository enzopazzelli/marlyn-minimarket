"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { clienteConfig } from "@/config/cliente";

export default function PaginaIngresar() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const datos = new FormData(evento.currentTarget);
    const supabase = crearClienteNavegador();

    const { error: errorIngreso } = await supabase.auth.signInWithPassword({
      email: String(datos.get("email")),
      password: String(datos.get("password")),
    });

    setCargando(false);

    if (errorIngreso) {
      setError("El usuario o la contraseña no son correctos");
      return;
    }

    router.replace("/ventas");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-marco px-4">
      <form
        onSubmit={alEnviar}
        className="flex w-full max-w-sm flex-col gap-4 rounded-[var(--radius-base)] bg-superficie p-6 shadow-lg"
      >
        <div className="mb-2 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl text-texto">
            {clienteConfig.comercio.nombre}
          </p>
          <p className="text-sm text-texto-suave">Ingresá con tu usuario</p>
        </div>

        <Campo
          etiqueta="Correo"
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
        />
        <Campo
          etiqueta="Contraseña"
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />

        {error && (
          <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">
            {error}
          </p>
        )}

        <Boton type="submit" disabled={cargando}>
          {cargando ? "Ingresando…" : "Ingresar"}
        </Boton>
      </form>
    </main>
  );
}
