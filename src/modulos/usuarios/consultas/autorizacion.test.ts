// @vitest-environment node
//
// exigirSesionDeDueño() es la única barrera antes de tocar auth.admin
// (crear un usuario, resetear una contraseña) — a diferencia de todo lo
// demás en este proyecto, ahí no hay una RLS de respaldo si este
// chequeo tuviera un agujero. Se prueba con sesiones reales (mismo
// patrón que el resto de rls.test.ts), no mockeada.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { exigirSesionDeDueño } from "./autorizacion";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const clienteServicio = createClient(url, serviceKey);
const clienteAnonimo = createClient(url, anonKey);

describe("exigirSesionDeDueño (Fase 3 de PLAN-ROLES-AUDITORIA.md)", () => {
  let operadorAuthId: string;
  let dueñoAuthId: string;
  let clienteOperador: SupabaseClient;
  let clienteDueño: SupabaseClient;

  beforeAll(async () => {
    const password = "prueba-rls-operador-123";

    const emailOperador = `operador-usuarios-${Date.now()}@marlyn-minimarket.test`;
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

    clienteOperador = createClient(url, anonKey);
    const { error: errorLoginOperador } = await clienteOperador.auth.signInWithPassword({
      email: emailOperador,
      password,
    });
    if (errorLoginOperador) throw errorLoginOperador;

    // Rol 'dueño' por defecto, no hace falta pisarlo.
    const emailDueño = `dueno-usuarios-${Date.now()}@marlyn-minimarket.test`;
    const { data: dueño, error: errorDueño } = await clienteServicio.auth.admin.createUser({
      email: emailDueño,
      password,
      email_confirm: true,
    });
    if (errorDueño || !dueño.user) throw errorDueño ?? new Error("No se pudo crear el dueño de prueba");
    dueñoAuthId = dueño.user.id;

    clienteDueño = createClient(url, anonKey);
    const { error: errorLoginDueño } = await clienteDueño.auth.signInWithPassword({ email: emailDueño, password });
    if (errorLoginDueño) throw errorLoginDueño;
  });

  afterAll(async () => {
    if (operadorAuthId) await clienteServicio.auth.admin.deleteUser(operadorAuthId);
    if (dueñoAuthId) await clienteServicio.auth.admin.deleteUser(dueñoAuthId);
  });

  it("sin sesión, rechaza", async () => {
    await expect(exigirSesionDeDueño(clienteAnonimo)).rejects.toThrow(/sesión activa/i);
  });

  it("con sesión de operador, rechaza", async () => {
    await expect(exigirSesionDeDueño(clienteOperador)).rejects.toThrow(/solo el dueño/i);
  });

  it("con sesión de dueño, no rechaza", async () => {
    await expect(exigirSesionDeDueño(clienteDueño)).resolves.toBeUndefined();
  });
});
