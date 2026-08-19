// @vitest-environment node
//
// auditoria_movimientos es la pieza más sensible de toda esta tanda de
// trabajo: junta movimientos de stock, cuenta corriente y caja de
// cualquier usuario en un solo lugar. Se prueba con sesiones reales
// (mismo patrón que el resto de rls.test.ts), no mockeada.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const clienteServicio = createClient(url, serviceKey);
const clienteAnonimo = createClient(url, anonKey);

describe("RLS de auditoria_movimientos (Fase 4 de PLAN-ROLES-AUDITORIA.md)", () => {
  let categoriaId: string;
  let productoId: string;
  let operadorAuthId: string;
  let dueñoAuthId: string;
  let clienteOperador: SupabaseClient;
  let clienteDueño: SupabaseClient;
  const motivoDePrueba = `Prueba de auditoría ${Date.now()}`;

  beforeAll(async () => {
    const { data: categoria, error: errorCategoria } = await clienteServicio
      .from("categorias")
      .insert({ nombre: "Categoría de prueba Auditoría" })
      .select("id")
      .single();
    if (errorCategoria || !categoria) throw errorCategoria ?? new Error("No se pudo crear la categoría de prueba");
    categoriaId = categoria.id;

    const { data: producto, error: errorProducto } = await clienteServicio
      .from("productos")
      .insert({ nombre: "Producto de prueba Auditoría", categoria_id: categoriaId, precio_venta: 100, stock_actual: 10 })
      .select("id")
      .single();
    if (errorProducto || !producto) throw errorProducto ?? new Error("No se pudo crear el producto de prueba");
    productoId = producto.id;

    const password = "prueba-rls-operador-123";

    const emailOperador = `operador-auditoria-${Date.now()}@marlyn-minimarket.test`;
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
    const emailDueño = `dueno-auditoria-${Date.now()}@marlyn-minimarket.test`;
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

    // Un movimiento real, hecho por el operador, vía la misma función
    // que usa la pantalla — no un insert directo — para que el test
    // cubra la cadena completa (RPC -> movimientos_stock -> vista).
    const { error: errorAjuste } = await clienteOperador.rpc("registrar_ajuste_stock", {
      p_producto_id: productoId,
      p_cantidad: 1,
      p_tipo: "salida",
      p_motivo: motivoDePrueba,
    });
    if (errorAjuste) throw errorAjuste;
  });

  afterAll(async () => {
    if (productoId) await clienteServicio.from("productos").delete().eq("id", productoId);
    if (categoriaId) await clienteServicio.from("categorias").delete().eq("id", categoriaId);
    if (operadorAuthId) await clienteServicio.auth.admin.deleteUser(operadorAuthId);
    if (dueñoAuthId) await clienteServicio.auth.admin.deleteUser(dueñoAuthId);
  });

  it("sin sesión no se puede leer auditoria_movimientos", async () => {
    const { data, error } = await clienteAnonimo.from("auditoria_movimientos").select("id").limit(1);

    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("el operador no ve nada en auditoria_movimientos (ni su propio movimiento)", async () => {
    const { data, error } = await clienteOperador.from("auditoria_movimientos").select("id, descripcion");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("el dueño ve el movimiento del operador, con el motivo real", async () => {
    const { data, error } = await clienteDueño
      .from("auditoria_movimientos")
      .select("tipo, descripcion, monto, usuario_id")
      .eq("usuario_id", operadorAuthId)
      .eq("tipo", "stock_salida");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].descripcion).toContain(motivoDePrueba);
    expect(Number(data?.[0].monto)).toBe(-1);
  });
});
