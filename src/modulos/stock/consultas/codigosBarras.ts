/** Funciones puras (sin Supabase ni navegador) para el pedido del dueño
 *  de 2026-09-02: hasta 20 códigos de barra por producto. El escáner del
 *  TPV, la carga rápida y el buscador de Stock tienen que mirar todos,
 *  no solo el principal — por eso la lógica vive acá y no repetida
 *  en cada pantalla.
 *
 *  El código principal sigue siendo `productos.codigo_barras`; el resto
 *  vive en `productos_codigos_barras` (migración 20260902110000).
 */

// 20 códigos por producto (1 principal + 19 adicionales). Arrancó en
// 6 y el dueño lo subió a 20 el mismo día: con las variantes de una
// misma marca que van al mismo precio, 6 se le quedaban cortos.
export const MAXIMO_CODIGOS_ADICIONALES = 19;

type ConCodigos = {
  codigoBarras: string | null;
  codigosAdicionales: string[];
};

/** El principal primero, después los adicionales. Sin vacíos. */
export function todosLosCodigos(producto: ConCodigos): string[] {
  const principal = producto.codigoBarras?.trim();
  const adicionales = (producto.codigosAdicionales ?? [])
    .map((codigo) => codigo?.trim())
    .filter((codigo): codigo is string => !!codigo);

  return principal ? [principal, ...adicionales] : adicionales;
}

/** Para el lector: el código escaneado tiene que dar exacto contra
 *  alguno de los que tenga cargados el producto. */
export function coincideCodigoExacto(producto: ConCodigos, codigo: string): boolean {
  const buscado = codigo.trim();
  if (!buscado) return false;
  return todosLosCodigos(producto).includes(buscado);
}

/** Para los buscadores escritos a mano, donde alcanza con que el término
 *  esté contenido (mismo criterio que ya tenían con el código único). */
export function contieneCodigo(producto: ConCodigos, termino: string): boolean {
  const buscado = termino.trim();
  if (!buscado) return false;
  return todosLosCodigos(producto).some((codigo) => codigo.includes(buscado));
}

/** El buscador de Ventas ahora es un solo campo para escanear Y para
 *  buscar por nombre (antes eran dos cajas separadas). Cuando alguien
 *  escanea un código que no existe en el catálogo, sigue mereciendo el
 *  aviso de error de siempre; cuando alguien tipea un nombre y aprieta
 *  Enter por costumbre sin haber elegido un producto de la grilla, no
 *  — no hay forma de distinguir "vino del lector" de "lo tipeó una
 *  persona" mirando solo el string, así que se corta por heurística:
 *  un código de barras real es todo dígitos y de varios caracteres: un
 *  nombre de producto, no. */
export function pareceCodigoDeBarras(texto: string): boolean {
  return /^\d{4,}$/.test(texto.trim());
}

export type ValidacionCodigos = {
  /** Listos para mandar a guardar_codigos_barras_adicionales(). */
  codigos: string[];
  error: string | null;
};

/** Limpia lo que viene de las 5 casillas del formulario: saca vacíos y
 *  espacios, y avisa si hay repetidos entre sí o contra el principal.
 *  La base también lo valida (unique + los dos triggers), pero el error
 *  de Postgres no se puede mostrar tal cual. */
export function validarCodigosAdicionales(
  codigos: string[],
  principal: string | null,
): ValidacionCodigos {
  const limpios = codigos.map((codigo) => codigo.trim()).filter((codigo) => codigo !== "");
  const principalLimpio = principal?.trim() ?? "";

  if (limpios.length > MAXIMO_CODIGOS_ADICIONALES) {
    return { codigos: [], error: `Se pueden cargar hasta ${MAXIMO_CODIGOS_ADICIONALES} códigos adicionales` };
  }

  const repetidoConPrincipal = principalLimpio && limpios.includes(principalLimpio);
  if (repetidoConPrincipal) {
    return { codigos: [], error: "Uno de los códigos adicionales es igual al principal" };
  }

  const vistos = new Set<string>();
  for (const codigo of limpios) {
    if (vistos.has(codigo)) {
      return { codigos: [], error: `El código ${codigo} está cargado dos veces` };
    }
    vistos.add(codigo);
  }

  return { codigos: limpios, error: null };
}
