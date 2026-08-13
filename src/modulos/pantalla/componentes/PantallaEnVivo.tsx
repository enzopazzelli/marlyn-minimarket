"use client";

import { useEffect, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { clienteConfig } from "@/config/cliente";
import { CANAL_EVENTO_CARRITO, nombreCanalPantalla, type CarritoPantalla } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

// Vive fuera de (app): nunca hay sesión acá (la TV del mostrador no
// inicia sesión, por diseño). crearClienteNavegador() sin sesión activa
// ya opera como anon, que es justo el rol que puede llamar a
// resolver_pantalla() y escuchar el canal de Realtime.
export function PantallaEnVivo({ token }: { token: string }) {
  const [valido, setValido] = useState<boolean | null>(null);
  const [carrito, setCarrito] = useState<CarritoPantalla | null>(null);

  useEffect(() => {
    let vigente = true;
    const supabase = crearClienteNavegador();
    supabase
      .rpc("resolver_pantalla", { p_token: token })
      .then(({ data, error }) => {
        if (!vigente) return;
        setValido(!error && !!data);
      });
    return () => {
      vigente = false;
    };
  }, [token]);

  useEffect(() => {
    if (!valido) return;
    const supabase = crearClienteNavegador();
    const canal = supabase
      .channel(nombreCanalPantalla(token))
      .on("broadcast", { event: CANAL_EVENTO_CARRITO }, ({ payload }) => {
        setCarrito(payload as CarritoPantalla);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [valido, token]);

  if (valido === false) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-marco px-8 text-center text-white">
        <p className="font-[family-name:var(--font-display)] text-2xl">Este código no es válido</p>
        <p className="max-w-md text-white/70">
          Pedile al dueño el link actualizado desde &ldquo;Pantalla al cliente&rdquo; en el sistema.
        </p>
      </main>
    );
  }

  const hayCarrito = valido && carrito && carrito.items.length > 0;

  if (!hayCarrito) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-marco px-8 text-center text-white">
        <p className="font-[family-name:var(--font-display)] text-3xl">{clienteConfig.comercio.nombre}</p>
        <p className="max-w-md text-white/70">
          En cuanto el mostrador empiece a cobrar, acá va a aparecer cada
          producto escaneado y el total.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col justify-between bg-marco px-10 py-10 text-white">
      <p className="font-[family-name:var(--font-display)] text-xl text-white/60">
        {clienteConfig.comercio.nombre}
      </p>
      <div className="flex-1 overflow-y-auto py-6">
        <ul className="flex flex-col gap-3">
          {carrito.items.map((item) => (
            <li key={item.productoId} className="flex items-baseline justify-between gap-4 text-2xl">
              <span>
                <span className="numero text-white/60">{item.cantidad} ×</span> {item.nombre}
              </span>
              <span className="numero shrink-0 font-semibold">
                {platita.format(item.cantidad * item.precioUnitario)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-baseline justify-between border-t border-white/20 pt-6">
        <span className="font-[family-name:var(--font-display)] text-2xl text-white/80">Total</span>
        <span className="numero text-6xl font-semibold text-acento">{platita.format(carrito.total)}</span>
      </div>
    </main>
  );
}
