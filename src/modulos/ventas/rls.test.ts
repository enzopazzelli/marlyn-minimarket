// @vitest-environment node
//
// El chequeo de sesión es lo primero que hace registrar_venta() (antes
// de tocar turnos_caja/productos), así que no hace falta sembrar datos
// reales para probar que sin sesión se corta ahí. Mismo patrón que
// src/modulos/stock/rls.test.ts.

import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const clienteAnonimo = createClient(url, anonKey);

describe("registrar_venta (M3 Ventas)", () => {
  it("sin sesión no se puede registrar una venta", async () => {
    const { error } = await clienteAnonimo.rpc("registrar_venta", {
      p_turno_caja_id: "00000000-0000-0000-0000-000000000000",
      p_cliente_id: null,
      p_items: [],
      p_pagos: [],
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/sesión activa/);
  });
});
