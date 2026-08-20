import { describe, expect, it } from "vitest";
import {
  SIN_RESOLVER,
  etiquetaTurno,
  mapaIdNombre,
  resolverFilaLegible,
  resolverFilasLegibles,
  type MapasLegibles,
} from "./backupLegible";

function mapasVacios(): MapasLegibles {
  return {
    categorias: new Map(),
    proveedores: new Map(),
    productos: new Map(),
    clientes: new Map(),
    perfiles: new Map(),
    ventas: new Map(),
    turnos: new Map(),
  };
}

describe("mapaIdNombre", () => {
  it("arma un mapa id -> nombre", () => {
    const mapa = mapaIdNombre([
      { id: "a", nombre: "Almacen" },
      { id: "b", nombre: "Bebidas" },
    ]);
    expect(mapa.get("a")).toBe("Almacen");
    expect(mapa.get("b")).toBe("Bebidas");
  });
});

describe("etiquetaTurno", () => {
  it("combina usuario y fecha formateada", () => {
    expect(etiquetaTurno("Admin", "2026-08-15T09:30:00.000Z")).toMatch(/^Admin — /);
  });

  it("usa SIN_RESOLVER si no hay usuario", () => {
    expect(etiquetaTurno(undefined, "2026-08-15T09:30:00.000Z").startsWith(`${SIN_RESOLVER} — `)).toBe(true);
  });
});

describe("resolverFilaLegible", () => {
  it("una tabla sin columnas FK vuelve igual", () => {
    const fila = { id: "1", nombre: "Almacen" };
    expect(resolverFilaLegible("categorias", fila, mapasVacios())).toEqual(fila);
  });

  it("reemplaza categoria_id/proveedor_id por nombre en productos, sin tocar el id propio", () => {
    const mapas = mapasVacios();
    mapas.categorias.set("cat-1", "Almacen");
    mapas.proveedores.set("prov-1", "Coca Cola");

    const fila = { id: "prod-1", nombre: "Fideos", categoria_id: "cat-1", proveedor_id: "prov-1" };
    const resultado = resolverFilaLegible("productos", fila, mapas);

    expect(resultado).toEqual({ id: "prod-1", nombre: "Fideos", categoria: "Almacen", proveedor: "Coca Cola" });
  });

  it("una FK nula se resuelve a null, no a SIN_RESOLVER", () => {
    const fila = { id: "prod-1", nombre: "Fideos", categoria_id: null, proveedor_id: null };
    const resultado = resolverFilaLegible("productos", fila, mapasVacios());
    expect(resultado.categoria).toBeNull();
    expect(resultado.proveedor).toBeNull();
  });

  it("un id que no está en el mapa se marca SIN_RESOLVER en vez de quedar en blanco", () => {
    const fila = { id: "prod-1", nombre: "Fideos", categoria_id: "cat-fantasma", proveedor_id: null };
    const resultado = resolverFilaLegible("productos", fila, mapasVacios());
    expect(resultado.categoria).toBe(SIN_RESOLVER);
  });

  it("dos columnas de la misma tabla apuntando al mismo mapa se resuelven independiente (ventas.usuario_id / anulada_por)", () => {
    const mapas = mapasVacios();
    mapas.perfiles.set("u-1", "Admin");
    mapas.perfiles.set("u-2", "Caja");

    const fila = { id: "v-1", numero: 10, usuario_id: "u-1", anulada_por: "u-2" };
    const resultado = resolverFilaLegible("ventas", fila, mapas);

    expect(resultado.usuario).toBe("Admin");
    expect(resultado.anulada_por).toBe("Caja");
  });
});

describe("resolverFilasLegibles", () => {
  it("aplica la resolución a todas las filas de la tabla", () => {
    const mapas = mapasVacios();
    mapas.clientes.set("cli-1", "Juan Pérez");
    const filas = [
      { id: "1", cliente_id: "cli-1", tipo: "fiado" },
      { id: "2", cliente_id: null, tipo: "fiado" },
    ];
    const resultado = resolverFilasLegibles("movimientos_cuenta_corriente", filas, mapas);
    expect(resultado[0].cliente).toBe("Juan Pérez");
    expect(resultado[1].cliente).toBeNull();
  });
});
