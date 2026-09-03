/** Funciones puras (sin Supabase ni navegador) para el pedido del
 *  cliente de 2026-09-02: dar de alta un colaborador con usuario y
 *  clave, sin pedirle un correo.
 *
 *  Supabase Auth necesita un email sí o sí para crear una cuenta, así
 *  que se le arma uno interno a partir del usuario
 *  (`marcos` -> `marcos@marlyn.local`). Ese correo no existe, nadie lo
 *  lee y no se le muestra a nadie: es solo la identidad que Auth pide.
 *  Por eso el dominio es `.local`, que por RFC 6762 nunca va a ser un
 *  dominio real y no puede colisionar con el correo de verdad de nadie.
 *
 *  Los dueños que ya entraban con su correo real siguen entrando igual:
 *  la pantalla de ingreso acepta las dos formas (ver credencialAEmail). */

export const DOMINIO_INTERNO = "marlyn.local";

/** Deja el usuario en algo que sirva como parte local de un email:
 *  minúsculas, sin acentos, espacios a punto, y sin ningún caracter
 *  raro que Auth pueda rechazar. */
export function normalizarUsuario(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "");
}

export function esEmail(valor: string): boolean {
  return valor.includes("@");
}

/** El correo interno con el que se crea la cuenta. */
export function emailDesdeUsuario(usuario: string): string {
  return `${normalizarUsuario(usuario)}@${DOMINIO_INTERNO}`;
}

/** Lo que se le manda a signInWithPassword. Si escribió un correo (los
 *  dueños viejos), va tal cual; si escribió un usuario, se le pega el
 *  dominio interno. */
export function credencialAEmail(valor: string): string {
  const limpio = valor.trim();
  return esEmail(limpio) ? limpio.toLowerCase() : emailDesdeUsuario(limpio);
}

/** null = está bien. Devuelve el motivo si no sirve como usuario. */
export function validarUsuario(valor: string): string | null {
  const normalizado = normalizarUsuario(valor);
  if (normalizado === "") return "Escribí un usuario";
  if (normalizado.length < 3) return "El usuario tiene que tener al menos 3 caracteres";
  if (esEmail(valor)) return "Poné solo el usuario, sin @ ni correo";
  return null;
}

/** Lo que se muestra en pantalla: para las cuentas internas, el usuario
 *  suelto; para los dueños con correo real, el correo entero. Sin esto
 *  la tabla de usuarios mostraría "marcos@marlyn.local", que es ruido
 *  —ese correo no existe ni se usa para nada. */
export function usuarioParaMostrar(email: string): string {
  const sufijo = `@${DOMINIO_INTERNO}`;
  return email.endsWith(sufijo) ? email.slice(0, -sufijo.length) : email;
}
