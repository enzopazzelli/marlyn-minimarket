// @vitest-environment node
//
// Mismo patrón que src/modulos/clientes/rls.test.ts: se crea el dato
// con la clave de servicio, se intenta con la clave pública (sin
// sesión) y se verifica que falla. Corre contra el Supabase hosteado
// configurado en .env.local.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const clienteServicio = createClient(url, serviceKey);
const clienteAnonimo = createClient(url, anonKey);

let notaId: string;

beforeAll(async () => {
  const { data: nota, error } = await clienteServicio
    .from("notas")
    .insert({ texto: "Nota de prueba RLS" })
    .select("id")
    .single();
  if (error || !nota) throw error ?? new Error("No se pudo crear la nota de prueba");
  notaId = nota.id;
});

afterAll(async () => {
  if (notaId) await clienteServicio.from("notas").delete().eq("id", notaId);
});

describe("RLS de notas", () => {
  it("sin sesión no se puede leer notas", async () => {
    const { data, error } = await clienteAnonimo.from("notas").select("id").eq("id", notaId);

    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("sin sesión no se puede crear una nota", async () => {
    const { error } = await clienteAnonimo.from("notas").insert({ texto: "Intento sin sesión" });

    expect(error?.code).toBe("42501");
  });

  it("sin sesión no se puede borrar una nota", async () => {
    const { error, count } = await clienteAnonimo.from("notas").delete({ count: "exact" }).eq("id", notaId);

    // RLS bloquea la fila (0 filas afectadas), no necesariamente un
    // error explícito: mismo criterio que un `update`/`delete` que no
    // matchea ninguna fila visible para ese rol.
    expect(error?.code === "42501" || count === 0).toBe(true);
  });
});
