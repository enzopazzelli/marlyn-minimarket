// Vista de solo lectura para la TV del mostrador (prompt-base sección
// 2.1). A propósito NO vive bajo (app): no comparte la sesión del
// operador, se autentica con su propio token de emparejamiento fijo
// (perfiles.token_pantalla, resuelto por resolver_pantalla() — ver
// PantallaEnVivo.tsx para la conexión en tiempo real).

import { PantallaEnVivo } from "@/modulos/pantalla/componentes/PantallaEnVivo";

export default async function PantallaCliente({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <PantallaEnVivo token={token} />;
}
