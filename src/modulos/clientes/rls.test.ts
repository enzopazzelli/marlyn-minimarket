// @vitest-environment node
//
// Mismo patrón que src/modulos/stock/rls.test.ts: se crea el dato con
// la clave de servicio, se intenta con la clave pública (sin sesión) y
// se verifica que falla. Corre contra el Supabase hosteado configurado
// en .env.local.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const clienteServicio = createClient(url, serviceKey);
const clienteAnonimo = createClient(url, anonKey);

let clienteId: string;

beforeAll(async () => {
  const { data: cliente, error } = await clienteServicio
    .from("clientes")
    .insert({ nombre: "Cliente de prueba RLS" })
    .select("id")
    .single();
  if (error || !cliente) throw error ?? new Error("No se pudo crear el cliente de prueba");
  clienteId = cliente.id;
});

afterAll(async () => {
  if (clienteId) await clienteServicio.from("clientes").delete().eq("id", clienteId);
});

describe("RLS de clientes (M2 Clientes)", () => {
  it("sin sesión no se puede leer clientes", async () => {
    const { data, error } = await clienteAnonimo.from("clientes").select("id").eq("id", clienteId);

    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("sin sesión no se puede registrar un movimiento de cuenta corriente", async () => {
    const { error } = await clienteAnonimo.rpc("registrar_movimiento_cuenta_corriente", {
      p_cliente_id: clienteId,
      p_tipo: "pago",
      p_monto: 100,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/sesión activa/);
  });
});

describe("Rol operador (Fase 1 de PLAN-ROLES-AUDITORIA.md)", () => {
  let operadorAuthId: string;
  let clienteOperador: SupabaseClient;

  beforeAll(async () => {
    const email = `operador-clientes-${Date.now()}@marlyn-minimarket.test`;
    const password = "prueba-rls-operador-123";
    const { data, error } = await clienteServicio.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("No se pudo crear el operador de prueba");
    operadorAuthId = data.user.id;

    const { error: errorRol } = await clienteServicio
      .from("perfiles")
      .update({ rol: "operador" })
      .eq("id", operadorAuthId);
    if (errorRol) throw errorRol;

    clienteOperador = createClient(url, anonKey);
    const { error: errorLogin } = await clienteOperador.auth.signInWithPassword({ email, password });
    if (errorLogin) throw errorLogin;
  });

  afterAll(async () => {
    if (operadorAuthId) await clienteServicio.auth.admin.deleteUser(operadorAuthId);
  });

  // El chequeo de rol va antes de buscar el cliente (ver el comentario
  // en la migración de Fase 1), así que ni hace falta que clienteId sea
  // real para probar el bloqueo — igual se reusa el fixture de arriba.
  it("el operador no puede aplicar un recargo por atraso", async () => {
    const { error } = await clienteOperador.rpc("registrar_movimiento_cuenta_corriente", {
      p_cliente_id: clienteId,
      p_tipo: "recargo",
      p_monto: 500,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/solo el dueño/i);
  });

  it("el operador sí puede registrar un pago", async () => {
    const { error } = await clienteOperador.rpc("registrar_movimiento_cuenta_corriente", {
      p_cliente_id: clienteId,
      p_tipo: "pago",
      p_monto: 50,
      p_medio: "transferencia",
    });

    expect(error).toBeNull();
  });
});
