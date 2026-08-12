// @vitest-environment node
//
// Tests de seguridad (prompt-base sección 7, punto 3): la RLS se aplica
// en el motor, no se puede mockear. Patrón: se crea el dato con la clave
// de servicio, se intenta la operación con la clave pública (sin sesión)
// y se verifica que falla, se limpia al final. Corren contra el Supabase
// local (`npx supabase start`), no contra un mock.
//
// Nota: en este proyecto "sin sesión no puede" se cumple en la capa de
// privilegios de Postgres (el rol `anon` no tiene GRANT sobre estas
// tablas, sección "auto_expose_new_tables" de supabase/config.toml) y
// también en la política RLS `..._acceso_perfil_activo`. Ambas fallan con
// SQLSTATE 42501, así que el test no distingue cuál de las dos capas es
// la que efectivamente bloqueó.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const clienteServicio = createClient(url, serviceKey);
const clienteAnonimo = createClient(url, anonKey);

let categoriaId: string;
let productoId: string;

beforeAll(async () => {
  const { data: categoria, error: errorCategoria } = await clienteServicio
    .from("categorias")
    .insert({ nombre: "Categoría de prueba RLS" })
    .select("id")
    .single();
  if (errorCategoria || !categoria) throw errorCategoria ?? new Error("No se pudo crear la categoría de prueba");
  categoriaId = categoria.id;

  const { data: producto, error: errorProducto } = await clienteServicio
    .from("productos")
    .insert({ nombre: "Producto de prueba RLS", categoria_id: categoriaId, precio_venta: 100 })
    .select("id")
    .single();
  if (errorProducto || !producto) throw errorProducto ?? new Error("No se pudo crear el producto de prueba");
  productoId = producto.id;
});

afterAll(async () => {
  if (productoId) await clienteServicio.from("productos").delete().eq("id", productoId);
  if (categoriaId) await clienteServicio.from("categorias").delete().eq("id", categoriaId);
});

describe("RLS de productos y categorías (M1 Stock)", () => {
  it("sin sesión no se puede leer productos", async () => {
    const { data, error } = await clienteAnonimo.from("productos").select("id").eq("id", productoId);

    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });

  it("sin sesión no se puede insertar un producto", async () => {
    const { error } = await clienteAnonimo
      .from("productos")
      .insert({ nombre: "Intento sin sesión", precio_venta: 1 });

    expect(error?.code).toBe("42501");
  });

  it("sin sesión no se puede leer categorías", async () => {
    const { data, error } = await clienteAnonimo.from("categorias").select("id").eq("id", categoriaId);

    expect(error?.code).toBe("42501");
    expect(data).toBeNull();
  });
});

describe("registrar_ingreso_stock (M1 Stock)", () => {
  // A diferencia de las tablas, Postgres otorga EXECUTE a PUBLIC por
  // default en funciones nuevas: acá el rol anon sí llega a ejecutar el
  // cuerpo de la función, pero el chequeo interno de auth_activo() la
  // frena antes de tocar ninguna tabla (mismo patrón que
  // registrar_venta/anular_venta).
  it("sin sesión no se puede ingresar mercadería", async () => {
    const { error } = await clienteAnonimo.rpc("registrar_ingreso_stock", {
      p_producto_id: productoId,
      p_cantidad: 1,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/sesión activa/);
  });
});
