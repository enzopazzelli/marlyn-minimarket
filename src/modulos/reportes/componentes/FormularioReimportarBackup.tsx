"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/componentes/Boton";
import { Modal } from "@/componentes/Modal";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import type { Categoria, Producto } from "@/modulos/stock/tipos";
import type { Proveedor } from "@/modulos/proveedores/tipos";
import type { Cliente } from "@/modulos/clientes/tipos";
import {
  construirReimportacionMaestros,
  type ExistentesReimportacion,
  type FilaExcelCategoria,
  type FilaExcelCliente,
  type FilaExcelProducto,
  type FilaExcelProveedor,
  type HojasReimportacion,
} from "../consultas/reimportarMaestros";

// Reverso de FormularioImportarExcel.tsx (Stock): en vez de un catálogo
// de proveedor, lee el mismo Excel que baja BotonDescargarBackup — solo
// las hojas "categorias", "proveedores", "productos" y "clientes"
// (datos maestros, ver el comentario de BotonDescargarBackup.tsx sobre
// por qué el resto queda afuera). Upsert por id: una fila con id
// existente edita, sin id da de alta, con id que no existe es error —
// nunca borra lo que falte en la hoja.
type Resultado = {
  categoriasCreadas: number;
  categoriasActualizadas: number;
  proveedoresCreados: number;
  proveedoresActualizados: number;
  productosCreados: number;
  productosActualizados: number;
  clientesCreados: number;
  clientesActualizados: number;
};

function textoCelda(valor: unknown): string {
  return valor === null || valor === undefined ? "" : String(valor).trim();
}

function comoBooleano(valor: unknown): boolean {
  if (typeof valor === "boolean") return valor;
  const texto = textoCelda(valor).toLowerCase();
  return texto === "true" || texto === "1" || texto === "verdadero";
}

function indicesEncabezado(valoresHeader: unknown[], columnas: string[]): Record<string, number> {
  const encabezado = valoresHeader.map((valor) => textoCelda(valor).toLowerCase());
  return Object.fromEntries(columnas.map((columna) => [columna, encabezado.indexOf(columna)]));
}

export function FormularioReimportarBackup({
  categorias,
  proveedores,
  productos,
  clientes,
}: {
  categorias: Categoria[];
  proveedores: Proveedor[];
  productos: Producto[];
  clientes: Cliente[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [hojas, setHojas] = useState<HojasReimportacion | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const existentes: ExistentesReimportacion = useMemo(
    () => ({
      categoriasPorId: new Set(categorias.map((categoria) => categoria.id)),
      proveedoresPorId: new Set(proveedores.map((proveedor) => proveedor.id)),
      productosPorId: new Set(productos.map((producto) => producto.id)),
      clientesPorId: new Set(clientes.map((cliente) => cliente.id)),
      categoriasPorNombre: new Set(categorias.map((categoria) => categoria.nombre.toLowerCase())),
      proveedoresPorNombre: new Set(proveedores.map((proveedor) => proveedor.nombre.toLowerCase())),
    }),
    [categorias, proveedores, productos, clientes],
  );

  const resumen = useMemo(() => {
    if (!hojas) return null;
    return construirReimportacionMaestros(hojas, existentes);
  }, [hojas, existentes]);

  function abrir() {
    setNombreArchivo(null);
    setHojas(null);
    setError(null);
    setResultado(null);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

  async function alElegirArchivo(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    setError(null);
    setCargando(true);
    setHojas(null);
    setNombreArchivo(archivo.name);

    try {
      const { default: ExcelJS } = await import("exceljs");
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(await archivo.arrayBuffer());

      const hojaCategorias = libro.getWorksheet("categorias");
      const hojaProveedores = libro.getWorksheet("proveedores");
      const hojaProductos = libro.getWorksheet("productos");
      const hojaClientes = libro.getWorksheet("clientes");

      const faltantes = [
        !hojaCategorias && "categorias",
        !hojaProveedores && "proveedores",
        !hojaProductos && "productos",
        !hojaClientes && "clientes",
      ].filter(Boolean);
      if (faltantes.length > 0) {
        setError(`Este Excel no tiene las hojas esperadas (faltan: ${faltantes.join(", ")}). Usá el backup completo.`);
        setCargando(false);
        return;
      }

      const categoriasParseadas: FilaExcelCategoria[] = [];
      const ic = indicesEncabezado(hojaCategorias!.getRow(1).values as unknown[], ["id", "nombre"]);
      hojaCategorias!.eachRow((fila, numeroFila) => {
        if (numeroFila === 1) return;
        const valores = fila.values as unknown[];
        const nombre = textoCelda(valores[ic.nombre]);
        if (!nombre) return;
        categoriasParseadas.push({ id: textoCelda(valores[ic.id]) || null, nombre });
      });

      const proveedoresParseados: FilaExcelProveedor[] = [];
      const ip = indicesEncabezado(hojaProveedores!.getRow(1).values as unknown[], [
        "id",
        "nombre",
        "contacto",
        "telefono",
      ]);
      hojaProveedores!.eachRow((fila, numeroFila) => {
        if (numeroFila === 1) return;
        const valores = fila.values as unknown[];
        const nombre = textoCelda(valores[ip.nombre]);
        if (!nombre) return;
        proveedoresParseados.push({
          id: textoCelda(valores[ip.id]) || null,
          nombre,
          contacto: textoCelda(valores[ip.contacto]) || null,
          telefono: textoCelda(valores[ip.telefono]) || null,
        });
      });

      const productosParseados: FilaExcelProducto[] = [];
      const ipr = indicesEncabezado(hojaProductos!.getRow(1).values as unknown[], [
        "id",
        "nombre",
        "categoria",
        "proveedor",
        "codigo_barras",
        "precio_costo",
        "precio_venta",
        "stock_minimo",
        "unidad",
        "activo",
      ]);
      hojaProductos!.eachRow((fila, numeroFila) => {
        if (numeroFila === 1) return;
        const valores = fila.values as unknown[];
        const nombre = textoCelda(valores[ipr.nombre]);
        if (!nombre) return;
        productosParseados.push({
          id: textoCelda(valores[ipr.id]) || null,
          nombre,
          categoriaNombre: textoCelda(valores[ipr.categoria]),
          proveedorNombre: textoCelda(valores[ipr.proveedor]) || null,
          codigoBarras: textoCelda(valores[ipr.codigo_barras]) || null,
          precioCosto: Number(valores[ipr.precio_costo] ?? 0),
          precioVenta: Number(valores[ipr.precio_venta] ?? 0),
          unidad: (textoCelda(valores[ipr.unidad]) || "unidad") as FilaExcelProducto["unidad"],
          stockMinimo: Number(valores[ipr.stock_minimo] ?? 0),
          activo: comoBooleano(valores[ipr.activo]),
        });
      });

      const clientesParseados: FilaExcelCliente[] = [];
      const icl = indicesEncabezado(hojaClientes!.getRow(1).values as unknown[], [
        "id",
        "nombre",
        "telefono",
        "direccion",
      ]);
      hojaClientes!.eachRow((fila, numeroFila) => {
        if (numeroFila === 1) return;
        const valores = fila.values as unknown[];
        const nombre = textoCelda(valores[icl.nombre]);
        if (!nombre) return;
        clientesParseados.push({
          id: textoCelda(valores[icl.id]) || null,
          nombre,
          telefono: textoCelda(valores[icl.telefono]) || null,
          direccion: textoCelda(valores[icl.direccion]) || null,
        });
      });

      setHojas({
        categorias: categoriasParseadas,
        proveedores: proveedoresParseados,
        productos: productosParseados,
        clientes: clientesParseados,
      });
    } catch {
      setError("No se pudo leer este archivo. Confirmá que sea un .xlsx válido (el backup completo descargado antes).");
    } finally {
      setCargando(false);
    }
  }

  async function confirmarReimportacion() {
    if (!resumen || resumen.errores.length > 0) return;
    setError(null);
    setCargando(true);
    try {
      const supabase = crearClienteNavegador();
      const { data, error: errorRpc } = await supabase.rpc("reimportar_maestros", {
        p_categorias_nuevas: resumen.categoriasNuevas,
        p_categorias_actualizar: resumen.categoriasActualizar,
        p_proveedores_nuevos: resumen.proveedoresNuevos,
        p_proveedores_actualizar: resumen.proveedoresActualizar,
        p_productos: resumen.productos,
        p_clientes: resumen.clientes,
      });

      if (errorRpc) {
        setError(errorRpc.message);
        return;
      }

      const fila = data?.[0];
      setResultado({
        categoriasCreadas: fila?.categorias_creadas ?? 0,
        categoriasActualizadas: fila?.categorias_actualizadas ?? 0,
        proveedoresCreados: fila?.proveedores_creados ?? 0,
        proveedoresActualizados: fila?.proveedores_actualizados ?? 0,
        productosCreados: fila?.productos_creados ?? 0,
        productosActualizados: fila?.productos_actualizados ?? 0,
        clientesCreados: fila?.clientes_creados ?? 0,
        clientesActualizados: fila?.clientes_actualizados ?? 0,
      });
      setHojas(null);
      router.refresh();
    } catch {
      setError("No se pudo reimportar. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <Boton type="button" variante="fantasma" onClick={abrir}>
        Reimportar backup
      </Boton>

      <Modal titulo="Reimportar datos maestros" abierto={abierto} onCerrar={cerrar}>
        <div className="flex flex-col gap-4">
          {resultado ? (
            <>
              <div className="rounded-[var(--radius-base)] bg-ok-fondo px-4 py-3 text-sm text-ok">
                Categorías: {resultado.categoriasCreadas} nuevas, {resultado.categoriasActualizadas} editadas.
                <br />
                Proveedores: {resultado.proveedoresCreados} nuevos, {resultado.proveedoresActualizados} editados.
                <br />
                Productos: {resultado.productosCreados} nuevos, {resultado.productosActualizados} editados.
                <br />
                Clientes: {resultado.clientesCreados} nuevos, {resultado.clientesActualizados} editados.
              </div>
              <div className="flex justify-end">
                <Boton type="button" variante="confirmar" onClick={cerrar}>
                  Listo
                </Boton>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-[var(--radius-base)] border border-linea p-3 text-xs text-texto-suave">
                Usá el mismo archivo que baja &quot;Descargar backup completo&quot;. Solo se editan/crean{" "}
                <span className="font-medium text-texto">categorías, proveedores, productos y clientes</span> — nunca
                se borra una fila que falte en el Excel, y el stock y el saldo de cuenta corriente no se tocan desde
                acá (eso sigue viniendo solo de ventas, ajustes de stock y pagos).
              </div>

              <div>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-texto-suave">Archivo (.xlsx)</span>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={alElegirArchivo}
                    className="rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-2 text-sm text-texto outline-none file:mr-3 file:rounded-[var(--radius-base)] file:border-0 file:bg-acento file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-acento-texto"
                  />
                </label>
              </div>

              {cargando && !resumen && <p className="text-sm text-texto-suave">Leyendo {nombreArchivo}…</p>}

              {resumen && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Estadistica etiqueta="Categorías nuevas" valor={resumen.categoriasNuevas.length} />
                    <Estadistica etiqueta="Categorías a editar" valor={resumen.categoriasActualizar.length} />
                    <Estadistica etiqueta="Proveedores nuevos" valor={resumen.proveedoresNuevos.length} />
                    <Estadistica etiqueta="Proveedores a editar" valor={resumen.proveedoresActualizar.length} />
                    <Estadistica
                      etiqueta="Productos"
                      valor={resumen.productos.length}
                      detalle={`${resumen.productos.filter((p) => !p.id).length} nuevos`}
                    />
                    <Estadistica
                      etiqueta="Clientes"
                      valor={resumen.clientes.length}
                      detalle={`${resumen.clientes.filter((c) => !c.id).length} nuevos`}
                    />
                  </div>

                  {resumen.errores.length > 0 && (
                    <div className="flex flex-col gap-1 rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-xs text-alerta">
                      <p className="font-medium">No se puede reimportar: {resumen.errores.length} fila(s) con error.</p>
                      <ul className="list-inside list-disc">
                        {resumen.errores.slice(0, 10).map((err, indice) => (
                          <li key={indice}>
                            {err.hoja}, fila {err.fila}: {err.motivo}
                          </li>
                        ))}
                      </ul>
                      {resumen.errores.length > 10 && <p>…y {resumen.errores.length - 10} más.</p>}
                    </div>
                  )}
                </>
              )}

              {error && (
                <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">{error}</p>
              )}

              <div className="flex justify-end gap-2">
                <Boton type="button" variante="fantasma" onClick={cerrar}>
                  Cancelar
                </Boton>
                {resumen && (
                  <Boton
                    type="button"
                    variante="confirmar"
                    disabled={cargando || resumen.errores.length > 0}
                    onClick={confirmarReimportacion}
                  >
                    {cargando ? "Reimportando…" : "Confirmar reimport"}
                  </Boton>
                )}
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

function Estadistica({ etiqueta, valor, detalle }: { etiqueta: string; valor: number; detalle?: string }) {
  return (
    <div className="rounded-[var(--radius-base)] bg-fondo px-3 py-2">
      <p className="text-[11px] text-texto-suave">{etiqueta}</p>
      <p className="numero text-base font-semibold text-texto">{valor}</p>
      {detalle && <p className="text-[11px] text-texto-suave">{detalle}</p>}
    </div>
  );
}
