import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// /pantalla es pública a propósito: la TV se autentica con su propio
// token de emparejamiento, no con la sesión del operador (sección 2.1).
const RUTAS_PUBLICAS = ["/ingresar", "/pantalla"];

// Refresca el token de sesión en cada request y sincroniza las cookies.
// Sin esto, un Server Component puede terminar leyendo un access token
// vencido. Se invoca desde src/proxy.ts (proxy.ts, no middleware.ts:
// convención renombrada en Next.js 16).
export async function actualizarSesion(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesParaSetear) {
          cookiesParaSetear.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          respuesta = NextResponse.next({ request });
          cookiesParaSetear.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) =>
    request.nextUrl.pathname.startsWith(ruta),
  );

  if (!user && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    return NextResponse.redirect(url);
  }

  return respuesta;
}
