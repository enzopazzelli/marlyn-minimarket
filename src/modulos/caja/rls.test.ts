// @vitest-environment node
//
// Mismo patrón que los demás rls.test.ts: se crea el dato con la clave
// de servicio, se prueba con la clave pública (con y sin sesión), se
// limpia al final. Corre contra el Supabase hosteado de .env.local.
//
// Caja no tenía rls.test.ts todavía — se crea acá porque la Fase 1 de
// PLAN-ROLES-AUDITORIA.md es la primera vez que sus policies
// diferencian por rol (antes "perfil activo" alcanzaba para todo, sin
// operador en el sistema no había nada que probar).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const clienteServicio = createClient(url, serviceKey);

describe("Rol operador en Caja (Fase 1 de PLAN-ROLES-AUDITORIA.md)", () => {
  let operadorAuthId: string;
  let otroUsuarioAuthId: string;
  let clienteOperador: SupabaseClient;
  let turnoOperadorId: string;
  let turnoAjenoId: string;

  beforeAll(async () => {
    const password = "prueba-rls-operador-123";
    const emailOperador = `operador-caja-${Date.now()}@marlyn-minimarket.test`;

    const { data: operador, error: errorOperador } = await clienteServicio.auth.admin.createUser({
      email: emailOperador,
      password,
      email_confirm: true,
    });
    if (errorOperador || !operador.user) throw errorOperador ?? new Error("No se pudo crear el operador de prueba");
    operadorAuthId = operador.user.id;

    const { error: errorRol } = await clienteServicio
      .from("perfiles")
      .update({ rol: "operador" })
      .eq("id", operadorAuthId);
    if (errorRol) throw errorRol;

    // Rol 'dueño' por defecto (el trigger lo pone así): solo hace falta
    // que sea "otro usuario" dueño de su propio turno, no un dueño real.
    const { data: otro, error: errorOtro } = await clienteServicio.auth.admin.createUser({
      email: `otro-usuario-caja-${Date.now()}@marlyn-minimarket.test`,
      password,
      email_confirm: true,
    });
    if (errorOtro || !otro.user) throw errorOtro ?? new Error("No se pudo crear el segundo usuario de prueba");
    otroUsuarioAuthId = otro.user.id;

    clienteOperador = createClient(url, anonKey);
    const { error: errorLogin } = await clienteOperador.auth.signInWithPassword({
      email: emailOperador,
      password,
    });
    if (errorLogin) throw errorLogin;

    const { data: turnoOperador, error: errorTurnoOperador } = await clienteServicio
      .from("turnos_caja")
      .insert({ usuario_id: operadorAuthId, monto_apertura: 0, estado: "cerrado" })
      .select("id")
      .single();
    if (errorTurnoOperador || !turnoOperador) {
      throw errorTurnoOperador ?? new Error("No se pudo crear el turno de prueba del operador");
    }
    turnoOperadorId = turnoOperador.id;

    const { data: turnoAjeno, error: errorTurnoAjeno } = await clienteServicio
      .from("turnos_caja")
      .insert({ usuario_id: otroUsuarioAuthId, monto_apertura: 0, estado: "cerrado" })
      .select("id")
      .single();
    if (errorTurnoAjeno || !turnoAjeno) {
      throw errorTurnoAjeno ?? new Error("No se pudo crear el turno ajeno de prueba");
    }
    turnoAjenoId = turnoAjeno.id;
  });

  afterAll(async () => {
    // Cascada: borrar el turno se lleva puestos sus movimientos_caja.
    // Errores chequeados a propósito (no un await suelto) — un delete
    // que falla en silencio deja basura de prueba colgada en la base
    // real, pasó de verdad en otros dos archivos de esta misma tanda.
    if (turnoOperadorId) {
      const { error } = await clienteServicio.from("turnos_caja").delete().eq("id", turnoOperadorId);
      if (error) throw error;
    }
    if (turnoAjenoId) {
      const { error } = await clienteServicio.from("turnos_caja").delete().eq("id", turnoAjenoId);
      if (error) throw error;
    }
    if (operadorAuthId) {
      const { error } = await clienteServicio.auth.admin.deleteUser(operadorAuthId);
      if (error) throw error;
    }
    if (otroUsuarioAuthId) {
      const { error } = await clienteServicio.auth.admin.deleteUser(otroUsuarioAuthId);
      if (error) throw error;
    }
  });

  it("el operador ve su propio turno cerrado", async () => {
    const { data, error } = await clienteOperador.from("turnos_caja").select("id").eq("id", turnoOperadorId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("el operador no ve el turno cerrado de otro usuario", async () => {
    const { data, error } = await clienteOperador.from("turnos_caja").select("id").eq("id", turnoAjenoId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("el operador no puede insertar un movimiento de caja a nombre de otro usuario", async () => {
    const { error } = await clienteOperador.from("movimientos_caja").insert({
      turno_id: turnoOperadorId,
      tipo: "ingreso",
      monto: 100,
      motivo: "Intento de spoofing",
      usuario_id: otroUsuarioAuthId,
    });

    expect(error?.code).toBe("42501");
  });

  it("el operador sí puede insertar un movimiento de caja a su propio nombre", async () => {
    const { error } = await clienteOperador.from("movimientos_caja").insert({
      turno_id: turnoOperadorId,
      tipo: "ingreso",
      monto: 100,
      motivo: "Movimiento legítimo del operador",
      usuario_id: operadorAuthId,
    });

    expect(error).toBeNull();
  });
});
