// @vitest-environment node
//
// Tests de seguridad (prompt-base sección 7, punto 3): la RLS y las
// validaciones de guardar_promocion()/activar_promocion() se aplican en
// el motor, no se pueden mockear. Mismo patrón que stock/rls.test.ts:
// se crea el dato con la clave de servicio o una sesión de dueño, se
// prueba con la sesión que corresponda, se limpia al final. Corren
// contra el Supabase hosteado (necesita las claves reales en
// .env.local) — por eso el nombre "rls.test.ts" (ver README, sección de
// convención de nombres de tests: CI corre solo lo que NO matchea
// "**/*rls.test.ts").

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const clienteServicio = createClient(url, serviceKey);
const clienteAnonimo = createClient(url, anonKey);

let productoAId: string;
let productoBId: string;
let operadorAuthId: string;
let dueñoAuthId: string;
let clienteOperador: SupabaseClient;
let clienteDueño: SupabaseClient;
const promocionesCreadas: string[] = [];

beforeAll(async () => {
  const { data: productoA, error: errorA } = await clienteServicio
    .from("productos")
    .insert({ nombre: "Producto de prueba promo A", precio_venta: 40 })
    .select("id")
    .single();
  if (errorA || !productoA) throw errorA ?? new Error("No se pudo crear el producto A de prueba");
  productoAId = productoA.id;

  const { data: productoB, error: errorB } = await clienteServicio
    .from("productos")
    .insert({ nombre: "Producto de prueba promo B", precio_venta: 2500 })
    .select("id")
    .single();
  if (errorB || !productoB) throw errorB ?? new Error("No se pudo crear el producto B de prueba");
  productoBId = productoB.id;

  const password = "prueba-rls-promociones-123";

  const emailOperador = `operador-promos-${Date.now()}@marlyn-minimarket.test`;
  const { data: operador, error: errorOperador } = await clienteServicio.auth.admin.createUser({
    email: emailOperador,
    password,
    email_confirm: true,
  });
  if (errorOperador || !operador.user) throw errorOperador ?? new Error("No se pudo crear el operador de prueba");
  operadorAuthId = operador.user.id;

  const { error: errorRolOperador } = await clienteServicio
    .from("perfiles")
    .update({ rol: "operador" })
    .eq("id", operadorAuthId);
  if (errorRolOperador) throw errorRolOperador;

  clienteOperador = createClient(url, anonKey);
  const { error: errorLoginOperador } = await clienteOperador.auth.signInWithPassword({
    email: emailOperador,
    password,
  });
  if (errorLoginOperador) throw errorLoginOperador;

  const emailDueño = `dueno-promos-${Date.now()}@marlyn-minimarket.test`;
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
  // Errores chequeados a propósito (ver el comentario del mismo bloque
  // en stock/rls.test.ts): que una limpieza falle en silencio deja
  // basura de prueba colgada en la base real.
  for (const id of promocionesCreadas) {
    const { error } = await clienteServicio.from("promociones").delete().eq("id", id);
    if (error) throw error;
  }
  if (productoAId) {
    const { error } = await clienteServicio.from("productos").delete().eq("id", productoAId);
    if (error) throw error;
  }
  if (productoBId) {
    const { error } = await clienteServicio.from("productos").delete().eq("id", productoBId);
    if (error) throw error;
  }
  if (operadorAuthId) {
    const { error } = await clienteServicio.auth.admin.deleteUser(operadorAuthId);
    if (error) throw error;
  }
  if (dueñoAuthId) {
    const { error } = await clienteServicio.auth.admin.deleteUser(dueñoAuthId);
    if (error) throw error;
  }
});

describe("RLS de promociones", () => {
  it("sin sesión no se puede leer promociones", async () => {
    const { data, error } = await clienteAnonimo.from("promociones").select("id").limit(1);
    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("sin sesión no se puede llamar guardar_promocion", async () => {
    const { error } = await clienteAnonimo.rpc("guardar_promocion", {
      p_id: null,
      p_nombre: "Intento sin sesión",
      p_tipo: "cantidad",
      p_precio_promocional: 100,
      p_activa: true,
      p_items: [{ producto_id: productoAId, cantidad: 3 }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/sesión activa/);
  });

  it("el operador puede LEER promociones (las necesita para que se apliquen en /ventas)", async () => {
    const { error } = await clienteOperador.from("promociones").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("el operador no puede crear una promoción", async () => {
    const { error } = await clienteOperador.rpc("guardar_promocion", {
      p_id: null,
      p_nombre: "Intento operador",
      p_tipo: "cantidad",
      p_precio_promocional: 100,
      p_activa: true,
      p_items: [{ producto_id: productoAId, cantidad: 3 }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/solo el dueño/i);
  });
});

describe("guardar_promocion — validaciones", () => {
  it("una promo 'cantidad' con dos productos se rechaza", async () => {
    const { error } = await clienteDueño.rpc("guardar_promocion", {
      p_id: null,
      p_nombre: "Cantidad inválida",
      p_tipo: "cantidad",
      p_precio_promocional: 100,
      p_activa: true,
      p_items: [
        { producto_id: productoAId, cantidad: 3 },
        { producto_id: productoBId, cantidad: 1 },
      ],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/exactamente un producto/i);
  });

  it("un combo con un solo producto se rechaza", async () => {
    const { error } = await clienteDueño.rpc("guardar_promocion", {
      p_id: null,
      p_nombre: "Combo inválido",
      p_tipo: "combo",
      p_precio_promocional: 100,
      p_activa: true,
      p_items: [{ producto_id: productoAId, cantidad: 1 }],
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/al menos dos productos/i);
  });

  it("crea una promo por cantidad, y una segunda sobre el mismo producto se rechaza", async () => {
    const { data: id, error } = await clienteDueño.rpc("guardar_promocion", {
      p_id: null,
      p_nombre: "3 A x $100",
      p_tipo: "cantidad",
      p_precio_promocional: 100,
      p_activa: true,
      p_items: [{ producto_id: productoAId, cantidad: 3 }],
    });
    expect(error).toBeNull();
    expect(id).not.toBeNull();
    if (id) promocionesCreadas.push(id as unknown as string);

    const { error: errorSolape } = await clienteDueño.rpc("guardar_promocion", {
      p_id: null,
      p_nombre: "Otra promo sobre A",
      p_tipo: "cantidad",
      p_precio_promocional: 90,
      p_activa: true,
      p_items: [{ producto_id: productoAId, cantidad: 5 }],
    });
    expect(errorSolape).not.toBeNull();
    expect(errorSolape?.message).toMatch(/ya tiene otra promoción por cantidad activa/i);
  });

  it("pausar la promo existente permite crear la segunda, y activar_promocion respeta el mismo chequeo", async () => {
    const promocionOriginalId = promocionesCreadas[0];

    const { error: errorPausar } = await clienteDueño.rpc("activar_promocion", {
      p_id: promocionOriginalId,
      p_activa: false,
    });
    expect(errorPausar).toBeNull();

    const { data: segundaId, error: errorSegunda } = await clienteDueño.rpc("guardar_promocion", {
      p_id: null,
      p_nombre: "Segunda promo sobre A",
      p_tipo: "cantidad",
      p_precio_promocional: 90,
      p_activa: true,
      p_items: [{ producto_id: productoAId, cantidad: 5 }],
    });
    expect(errorSegunda).toBeNull();
    if (segundaId) promocionesCreadas.push(segundaId as unknown as string);

    // Reactivar la primera ahora sí choca contra la segunda, que quedó activa.
    const { error: errorReactivar } = await clienteDueño.rpc("activar_promocion", {
      p_id: promocionOriginalId,
      p_activa: true,
    });
    expect(errorReactivar).not.toBeNull();
    expect(errorReactivar?.message).toMatch(/ya tiene otra promoción por cantidad activa/i);
  });

  it("crea un combo de dos productos distintos", async () => {
    const { data: id, error } = await clienteDueño.rpc("guardar_promocion", {
      p_id: null,
      p_nombre: "Combo A + B",
      p_tipo: "combo",
      p_precio_promocional: 2000,
      p_activa: true,
      p_items: [
        { producto_id: productoAId, cantidad: 1 },
        { producto_id: productoBId, cantidad: 1 },
      ],
    });
    expect(error).toBeNull();
    expect(id).not.toBeNull();
    if (id) promocionesCreadas.push(id as unknown as string);
  });
});
