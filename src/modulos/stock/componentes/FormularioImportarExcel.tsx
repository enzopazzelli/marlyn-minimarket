"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import { clienteConfig } from "@/config/cliente";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { calcularPrecioVentaDesdeGanancia } from "../consultas/precios";
import { construirImportacion, type FilaExcelCatalogo } from "../consultas/importarExcel";
import type { Categoria, Producto, Proveedor } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const COLUMNAS_ESPERADAS = ["descripcion", "proveedor", "codigo de barra", "familia", "costo"];

type Resultado = { productosCreados: number; categoriasCreadas: number; proveedoresCreados: number };

export function FormularioImportarExcel({
  categorias,
  proveedores,
  productos,
}: {
  categorias: Categoria[];
  proveedores: Proveedor[];
  productos: Producto[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaExcelCatalogo[] | null>(null);
  const [porcentajeGanancia, setPorcentajeGanancia] = useState("30");
  const [incluyeIva, setIncluyeIva] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function abrir() {
    setNombreArchivo(null);
    setFilas(null);
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
    setFilas(null);
    setNombreArchivo(archivo.name);

    try {
      const { default: ExcelJS } = await import("exceljs");
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(await archivo.arrayBuffer());
      const hoja = libro.worksheets[0];
      if (!hoja) throw new Error("El archivo no tiene ninguna hoja.");

      const valoresHeader = hoja.getRow(1).values as unknown[];
      const encabezado = valoresHeader.map((valor) =>
        valor === undefined || valor === null ? "" : String(valor).trim().toLowerCase(),
      );
      const indices = Object.fromEntries(COLUMNAS_ESPERADAS.map((col) => [col, encabezado.indexOf(col)]));
      const faltantes = COLUMNAS_ESPERADAS.filter((col) => indices[col] === -1);
      if (faltantes.length > 0) {
        setError(`Este Excel no tiene las columnas esperadas (faltan: ${faltantes.join(", ")}).`);
        setCargando(false);
        return;
      }

      const filasParseadas: FilaExcelCatalogo[] = [];
      hoja.eachRow((fila, numeroFila) => {
        if (numeroFila === 1) return;
        const valores = fila.values as unknown[];
        const descripcion = String(valores[indices.descripcion] ?? "").trim();
        if (!descripcion) return;
        filasParseadas.push({
          descripcion,
          proveedor: String(valores[indices.proveedor] ?? "").trim(),
          codigoBarra: valores[indices["codigo de barra"]] as string | number | null | undefined,
          familia: String(valores[indices.familia] ?? "").trim(),
          costo: Number(valores[indices.costo] ?? 0),
        });
      });

      if (filasParseadas.length === 0) {
        setError("No se encontró ninguna fila con datos en este Excel.");
        setCargando(false);
        return;
      }

      setFilas(filasParseadas);
    } catch {
      setError("No se pudo leer este archivo. Confirmá que sea un .xlsx válido.");
    } finally {
      setCargando(false);
    }
  }

  const resumen = useMemo(() => {
    if (!filas) return null;
    return construirImportacion(
      filas,
      {
        categorias: categorias.map((categoria) => categoria.nombre),
        proveedores: proveedores.map((proveedor) => proveedor.nombre),
        codigosBarras: productos.map((producto) => producto.codigoBarras).filter((codigo) => !!codigo) as string[],
      },
      {
        porcentajeGanancia: Number(porcentajeGanancia) || 0,
        incluyeIva,
        ivaPorcentaje: clienteConfig.reglasNegocio.ivaPorcentaje,
      },
    );
  }, [filas, categorias, proveedores, productos, porcentajeGanancia, incluyeIva]);

  const ejemploPrecioVenta = calcularPrecioVentaDesdeGanancia(
    1000,
    Number(porcentajeGanancia) || 0,
    incluyeIva,
    clienteConfig.reglasNegocio.ivaPorcentaje,
  );

  async function confirmarImportacion() {
    if (!resumen || resumen.aImportar === 0) return;
    setError(null);
    setCargando(true);
    try {
      const supabase = crearClienteNavegador();
      const { data, error: errorRpc } = await supabase.rpc("importar_catalogo", {
        p_categorias_nuevas: resumen.categoriasNuevas,
        p_proveedores_nuevos: resumen.proveedoresNuevos,
        p_productos: resumen.productos,
      });

      if (errorRpc) {
        setError(errorRpc.message);
        return;
      }

      const fila = data?.[0];
      setResultado({
        productosCreados: fila?.productos_creados ?? resumen.aImportar,
        categoriasCreadas: fila?.categorias_creadas ?? resumen.categoriasNuevas.length,
        proveedoresCreados: fila?.proveedores_creados ?? resumen.proveedoresNuevos.length,
      });
      setFilas(null);
      router.refresh();
    } catch {
      setError("No se pudo importar. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <Boton type="button" variante="fantasma" onClick={abrir}>
        Importar Excel
      </Boton>

      <Modal titulo="Importar catálogo desde Excel" abierto={abierto} onCerrar={cerrar}>
        <div className="flex flex-col gap-4">
          {resultado ? (
            <>
              <div className="rounded-[var(--radius-base)] bg-ok-fondo px-4 py-3 text-sm text-ok">
                Se importaron {resultado.productosCreados} productos
                {resultado.categoriasCreadas > 0 && `, ${resultado.categoriasCreadas} rubros nuevos`}
                {resultado.proveedoresCreados > 0 && ` y ${resultado.proveedoresCreados} proveedores nuevos`}.
              </div>
              <div className="flex justify-end">
                <Boton type="button" variante="confirmar" onClick={cerrar}>
                  Listo
                </Boton>
              </div>
            </>
          ) : (
            <>
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
                <p className="mt-1 text-xs text-texto-suave">
                  Columnas esperadas: Descripcion, Proveedor, Codigo de barra, Familia, Costo.
                </p>
              </div>

              {cargando && !resumen && <p className="text-sm text-texto-suave">Leyendo {nombreArchivo}…</p>}

              {resumen && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Estadistica etiqueta="Filas en el archivo" valor={resumen.totalFilas} />
                    <Estadistica etiqueta="Se importan" valor={resumen.aImportar} destacado="ok" />
                    <Estadistica etiqueta="Se saltean (código ya existe)" valor={resumen.salteadasPorCodigoExistente} />
                    <Estadistica etiqueta="Sin código de barras" valor={resumen.sinCodigoBarras} />
                    <Estadistica etiqueta="Rubros nuevos" valor={resumen.categoriasNuevas.length} />
                    <Estadistica etiqueta="Proveedores nuevos" valor={resumen.proveedoresNuevos.length} />
                  </div>

                  <div className="flex flex-col gap-2 rounded-[var(--radius-base)] border border-linea p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-texto-suave">
                      El Excel no trae precio de venta
                    </p>
                    <div className="flex items-end gap-3">
                      <div className="w-28">
                        <Campo
                          etiqueta="% de margen"
                          id="porcentajeGanancia"
                          type="number"
                          min={0}
                          step="1"
                          value={porcentajeGanancia}
                          onChange={(evento) => setPorcentajeGanancia(evento.target.value)}
                        />
                      </div>
                      <label className="flex items-center gap-1.5 pb-2 text-sm text-texto">
                        <input
                          type="checkbox"
                          checked={incluyeIva}
                          onChange={(evento) => setIncluyeIva(evento.target.checked)}
                          className="h-4 w-4 accent-acento"
                        />
                        Incluye IVA
                      </label>
                    </div>
                    <p className="text-xs text-texto-suave">
                      Ejemplo: costo {platita.format(1000)} → precio de venta{" "}
                      <span className="numero font-semibold text-texto">{platita.format(ejemploPrecioVenta)}</span>
                    </p>
                  </div>

                  <p className="text-xs text-texto-suave">
                    El stock arranca en 0 para todos los productos importados — el conteo físico se carga después,
                    producto por producto, como ya se hace hoy.
                  </p>
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
                    disabled={cargando || resumen.aImportar === 0}
                    onClick={confirmarImportacion}
                  >
                    {cargando ? "Importando…" : `Confirmar import (${resumen.aImportar})`}
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

function Estadistica({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string;
  valor: number;
  destacado?: "ok";
}) {
  return (
    <div className="rounded-[var(--radius-base)] bg-fondo px-3 py-2">
      <p className="text-[11px] text-texto-suave">{etiqueta}</p>
      <p className={`numero text-base font-semibold ${destacado === "ok" ? "text-ok" : "text-texto"}`}>{valor}</p>
    </div>
  );
}
