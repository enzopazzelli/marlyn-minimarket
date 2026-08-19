const horaFormateador = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" });

const fechaHoraFormateador = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Mismo motivo que formatearHora de más abajo (normaliza el espacio
// antes de "a./p. m." para que servidor y cliente no difieran byte a
// byte), para tablas que muestran un rango de días en vez de solo
// "hoy" (Auditoría).
export function formatearFechaHora(fecha: string | Date): string {
  return fechaHoraFormateador.format(new Date(fecha)).replace(/[   ]/g, " ");
}

// Intl.DateTimeFormat con es-AR separa la hora de "a. m."/"p. m." con un
// caracter de espacio distinto segun el motor ICU: espacio angosto
// (codigo U+202F) en algunos, espacio de no separacion (U+00A0) en
// otros, espacio comun en otros mas. Mismo horario, bytes distintos
// entre el Node del servidor y el V8 del navegador -- React tira
// "Hydration failed" al comparar el HTML del servidor contra el del
// cliente. Se normaliza aca, el unico lugar que formatea horas para
// mostrar en pantalla (los exports a Excel no lo necesitan: ahi no hay
// hidratacion de por medio).
export function formatearHora(fecha: string | Date): string {
  return horaFormateador.format(new Date(fecha)).replace(/[  ]/g, " ");
}
