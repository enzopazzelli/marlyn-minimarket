export type TurnoCaja = {
  id: string;
  usuarioId: string;
  montoApertura: number;
  montoCierreDeclarado: number | null;
  montoCierreCalculado: number | null;
  estado: "abierto" | "cerrado";
  abiertoEn: string;
  cerradoEn: string | null;
};

export type MovimientoCaja = {
  id: string;
  turnoId: string;
  tipo: "ingreso" | "egreso";
  monto: number;
  motivo: string;
  creadoEn: string;
};
