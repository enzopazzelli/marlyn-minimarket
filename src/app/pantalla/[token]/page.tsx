// Vista de solo lectura para la TV del mostrador (prompt-base sección
// 2.1). A propósito NO vive bajo (app): no comparte la sesión del
// operador, se autentica con su propio token de emparejamiento.
//
// PENDIENTE (fuera de esta primera pasada): validar el token contra un
// emparejamiento real y suscribirse por Supabase Realtime a la venta en
// curso de esa terminal. Por ahora es una pantalla de espera estática
// para dejar la ruta, el layout de TV y la exclusión de auth listos.

export default async function PantallaCliente({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-marco px-8 text-center text-white">
      <p className="font-[family-name:var(--font-display)] text-3xl">
        {process.env.NODE_ENV === "development" ? `Pantalla en espera (token ${token})` : "Pantalla en espera"}
      </p>
      <p className="max-w-md text-white/70">
        En cuanto el mostrador empiece a cobrar, acá va a aparecer cada
        producto escaneado y el total.
      </p>
    </main>
  );
}
