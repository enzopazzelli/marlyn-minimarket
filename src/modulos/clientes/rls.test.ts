// @vitest-environment node
//
// Mismo patrón que src/modulos/stock/rls.test.ts: se crea el dato con
// la clave de servicio, se intenta con la clave pública (sin sesión) y
// se verifica que falla. Corre contra el Supabase hosteado configurado
// en .env.local.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

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
