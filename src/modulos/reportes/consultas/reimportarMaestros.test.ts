import { describe, expect, it } from "vitest";
import { construirReimportacionMaestros, type ExistentesReimportacion, type HojasReimportacion } from "./reimportarMaestros";

function hojasVacias(): HojasReimportacion {
  return { categorias: [], proveedores: [], productos: [], clientes: [] };
}

function existentesVacios(): ExistentesReimportacion {
  return {
    categoriasPorId: new Set(),
    proveedoresPorId: new Set(),
    productosPorId: new Set(),
    clientesPorId: new Set(),
    categoriasPorNombre: new Set(),
    proveedoresPorNombre: new Set(),
  };
}

function producto(datos: Partial<HojasReimportacion["productos"][number]>): HojasReimportacion["productos"][number] {
  return {
    id: null,
    nombre: "Fideos",
    categoriaNombre: "Almacen",
    proveedorNombre: null,
    codigoBarras: null,
    precioCosto: 100,
    precioVenta: 150,
    unidad: "unidad",
    stockMinimo: 0,
    activo: true,
    ...datos,
  };
}

describe("construirReimportacionMaestros", () => {
  it("sin filas, todo vacío", () => {
    const resumen = construirReimportacionMaestros(hojasVacias(), existentesVacios());
    expect(resumen).toEqual({
      categoriasNuevas: [],
      categoriasActualizar: [],
      proveedoresNuevos: [],
      proveedoresActualizar: [],
      productos: [],
      clientes: [],
      errores: [],
    });
  });

  it("categoria con id existente es edición, no alta", () => {
    const existentes = { ...existentesVacios(), categoriasPorId: new Set(["cat-1"]) };
    const hojas = { ...hojasVacias(), categorias: [{ id: "cat-1", nombre: "Almacén" }] };
    const resumen = construirReimportacionMaestros(hojas, existentes);
    expect(resumen.categoriasActualizar).toEqual([{ id: "cat-1", nombre: "Almacén" }]);
    expect(resumen.categoriasNuevas).toEqual([]);
  });

  it("categoria con id que no existe en la base es un error, nunca una alta", () => {
    const hojas = { ...hojasVacias(), categorias: [{ id: "cat-fantasma", nombre: "Almacén" }] };
    const resumen = construirReimportacionMaestros(hojas, existentesVacios());
    expect(resumen.categoriasActualizar).toEqual([]);
    expect(resumen.categoriasNuevas).toEqual([]);
    expect(resumen.errores).toEqual([{ hoja: "categorias", fila: 2, motivo: 'El id "cat-fantasma" no existe' }]);
  });

  it("categoria sin id y nombre nuevo es alta", () => {
    const hojas = { ...hojasVacias(), categorias: [{ id: null, nombre: "bebidas" }] };
    const resumen = construirReimportacionMaestros(hojas, existentesVacios());
    expect(resumen.categoriasNuevas).toEqual(["Bebidas"]);
  });

  it("categoria sin id pero con nombre ya existente no se duplica como alta", () => {
    const existentes = { ...existentesVacios(), categoriasPorNombre: new Set(["almacen"]) };
    const hojas = { ...hojasVacias(), categorias: [{ id: null, nombre: "Almacen" }] };
    const resumen = construirReimportacionMaestros(hojas, existentes);
    expect(resumen.categoriasNuevas).toEqual([]);
  });

  it("producto con id existente se resuelve como edición (id se conserva)", () => {
    const existentes = { ...existentesVacios(), productosPorId: new Set(["prod-1"]) };
    const hojas = { ...hojasVacias(), productos: [producto({ id: "prod-1" })] };
    const resumen = construirReimportacionMaestros(hojas, existentes);
    expect(resumen.productos[0].id).toBe("prod-1");
    expect(resumen.errores).toEqual([]);
  });

  it("producto con id que no existe en la base es error, no se procesa", () => {
    const hojas = { ...hojasVacias(), productos: [producto({ id: "prod-fantasma" })] };
    const resumen = construirReimportacionMaestros(hojas, existentesVacios());
    expect(resumen.productos).toEqual([]);
    expect(resumen.errores).toEqual([{ hoja: "productos", fila: 2, motivo: 'El id "prod-fantasma" no existe' }]);
  });

  it("producto sin id es alta nueva", () => {
    const hojas = { ...hojasVacias(), productos: [producto({ id: null })] };
    const resumen = construirReimportacionMaestros(hojas, existentesVacios());
    expect(resumen.productos[0].id).toBeNull();
  });

  it("producto con categoria/proveedor nuevos los suma a las listas de alta", () => {
    const hojas = {
      ...hojasVacias(),
      productos: [producto({ categoriaNombre: "Bebidas", proveedorNombre: "coca cola" })],
    };
    const resumen = construirReimportacionMaestros(hojas, existentesVacios());
    expect(resumen.categoriasNuevas).toEqual(["Bebidas"]);
    expect(resumen.proveedoresNuevos).toEqual(["Coca Cola"]);
  });

  it("producto sin proveedor no crea un proveedor vacío", () => {
    const hojas = { ...hojasVacias(), productos: [producto({ proveedorNombre: null })] };
    const resumen = construirReimportacionMaestros(hojas, existentesVacios());
    expect(resumen.proveedoresNuevos).toEqual([]);
    expect(resumen.productos[0].proveedorNombre).toBeNull();
  });

  it("cliente con id existente es edición; con id inexistente es error", () => {
    const existentes = { ...existentesVacios(), clientesPorId: new Set(["cli-1"]) };
    const hojas = {
      ...hojasVacias(),
      clientes: [
        { id: "cli-1", nombre: "Juan Pérez", telefono: null, direccion: null },
        { id: "cli-fantasma", nombre: "Ana", telefono: null, direccion: null },
      ],
    };
    const resumen = construirReimportacionMaestros(hojas, existentes);
    expect(resumen.clientes).toEqual([{ id: "cli-1", nombre: "Juan Pérez", telefono: null, direccion: null }]);
    expect(resumen.errores).toEqual([{ hoja: "clientes", fila: 3, motivo: 'El id "cli-fantasma" no existe' }]);
  });

  it("fila sin nombre es error en cualquier hoja", () => {
    const hojas = { ...hojasVacias(), clientes: [{ id: null, nombre: "  ", telefono: null, direccion: null }] };
    const resumen = construirReimportacionMaestros(hojas, existentesVacios());
    expect(resumen.clientes).toEqual([]);
    expect(resumen.errores).toEqual([{ hoja: "clientes", fila: 2, motivo: "Nombre vacío" }]);
  });
});
