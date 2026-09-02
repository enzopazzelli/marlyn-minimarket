"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import { clienteConfig } from "@/config/cliente";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { useEsDueño } from "@/lib/supabase/PerfilContext";
import { calcularPrecioVentaDesdeGanancia } from "../consultas/precios";
import {
  COLUMNAS_CATALOGO,
  COLUMNAS_PLANTILLA,
  construirImportacion,
  construirImportacionDesdePlantilla,
  detectarFormato,
  normalizarEncabezado,
  type FilaExcelCatalogo,
  type FilaExcelPlantilla,
} from "../consultas/importarExcel";
import type { Categoria, Producto, Proveedor } from "../tipos";

const platita = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

type Resultado = { productosCreados: number; categoriasCreadas: number; proveedoresCreados: number };

// La tabla que se muestra SIEMPRE arriba del selector de archivo. El
// cliente reportó dos veces el mismo problema (columnas con otro nombre,
// precios como texto) porque el formato solo estaba escrito en una
// línea chica debajo del input, y solo aparecía el error después de
// elegir el archivo. Ahora es lo primero que se ve, con el tipo de dato
// de cada columna y qué pasa si la celda va vacía.
const FORMATO_PLANTILLA: { columna: string; tipo: string; siVaVacia: string }[] = [
  { columna: "Código de barras", tipo: "Texto o número", siVaVacia: "Producto sin código" },
  { columna: "Producto", tipo: "Texto", siVaVacia: "La fila se ignora" },
  { columna: "Rubro", tipo: "Texto", siVaVacia: "Queda sin rubro" },
  { columna: "Proveedor", tipo: "Texto", siVaVacia: "Queda sin proveedor" },
  { columna: "Precio costo", tipo: "Número", siVaVacia: "Queda en 0" },
  { columna: "Precio venta", tipo: "Número", siVaVacia: "Queda en 0" },
  { columna: "Stock actual", tipo: "Número", siVaVacia: "No se importa nunca" },
  { columna: "Stock mínimo", tipo: "Número", siVaVacia: "Queda en 0" },
  { columna: "Unidad", tipo: "unidad, kg o litro", siVaVacia: "Queda en unidad" },
];

// Dueño-only (Fase 5 de PLAN-ROLES-AUDITORIA.md): alta masiva es
// catálogo, igual que el alta de a uno — importar_catalogo() ya lo
// exige en la base, esto evita mostrar el botón.
export function FormularioImportarExcel({
  categorias,
  proveedores,
  productos,
}: {
  categorias: Categoria[];
  proveedores: Proveedor[];
  productos: Producto[];
}) {
  const esDueño = useEsDueño();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [filasCatalogo, setFilasCatalogo] = useState<FilaExcelCatalogo[] | null>(null);
  const [filasPlantilla, setFilasPlantilla] = useState<FilaExcelPlantilla[] | null>(null);
  const [porcentajeGanancia, setPorcentajeGanancia] = useState("30");
  const [incluyeIva, setIncluyeIva] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const existentes = useMemo(
    () => ({
      categorias: categorias.map((categoria) => categoria.nombre),
      proveedores: proveedores.map((proveedor) => proveedor.nombre),
      codigosBarras: productos
        .map((producto) => producto.codigoBarras)
        .filter((codigo) => !!codigo) as string[],
    }),
    [categorias, proveedores, productos],
  );

  // Los dos useMemo van acá arriba, antes del `if` de rol: los hooks no
  // pueden llamarse condicionalmente (react-hooks/rules-of-hooks).
  const resumenCatalogo = useMemo(() => {
    if (!filasCatalogo) return null;
    return construirImportacion(filasCatalogo, existentes, {
      porcentajeGanancia: Number(porcentajeGanancia) || 0,
      incluyeIva,
      ivaPorcentaje: clienteConfig.reglasNegocio.ivaPorcentaje,
    });
  }, [filasCatalogo, existentes, porcentajeGanancia, incluyeIva]);

  const resumenPlantilla = useMemo(() => {
    if (!filasPlantilla) return null;
    return construirImportacionDesdePlantilla(filasPlantilla, existentes);
  }, [filasPlantilla, existentes]);

  if (!esDueño) return null;

  const aImportar = resumenPlantilla?.aImportar ?? resumenCatalogo?.aImportar ?? 0;
  const hayResumen = resumenPlantilla !== null || resumenCatalogo !== null;

  function abrir() {
    setNombreArchivo(null);
    setFilasCatalogo(null);
    setFilasPlantilla(null);
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
    setFilasCatalogo(null);
    setFilasPlantilla(null);
    setNombreArchivo(archivo.name);

    try {
      const { default: ExcelJS } = await import("exceljs");
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(await archivo.arrayBuffer());
      const hoja = libro.worksheets[0];
      if (!hoja) throw new Error("El archivo no tiene ninguna hoja.");

      const valoresHeader = hoja.getRow(1).values as unknown[];
      const encabezado = valoresHeader.map(normalizarEncabezado);
      const { formato, faltantes } = detectarFormato(valoresHeader);

      if (faltantes.length > 0) {
        const esperadas = formato === "plantilla" ? COLUMNAS_PLANTILLA : COLUMNAS_CATALOGO;
        setError(
          `Faltan columnas: ${faltantes.join(", ")}. Este archivo se parece al formato ` +
            `${formato === "plantilla" ? "de la plantilla del sistema" : "del sistema anterior"}, ` +
            `que necesita: ${esperadas.join(", ")}.`,
        );
        setCargando(false);
        return;
      }

      const indice = (columna: string) => encabezado.indexOf(columna);

      if (formato === "plantilla") {
        const iCodigo = indice("codigo de barras");
        const iProducto = indice("producto");
        const iRubro = indice("rubro");
        const iProveedor = indice("proveedor");
        const iCosto = indice("precio costo");
        const iVenta = indice("precio venta");
        const iStock = indice("stock actual");
        const iStockMin = indice("stock minimo");
        const iUnidad = indice("unidad");

        const parseadas: FilaExcelPlantilla[] = [];
        hoja.eachRow((fila, numeroFila) => {
          if (numeroFila === 1) return;
          const valores = fila.values as unknown[];
          const producto = String(valores[iProducto] ?? "").trim();
          if (!producto) return;
          parseadas.push({
            numeroFila,
            producto,
            rubro: String(valores[iRubro] ?? "").trim(),
            proveedor: String(valores[iProveedor] ?? "").trim(),
            codigoBarra: valores[iCodigo] as string | number | null | undefined,
            precioCosto: valores[iCosto],
            precioVenta: valores[iVenta],
            // Las dos de stock son opcionales: si la hoja no las trae,
            // indice() da -1 y valores[-1] es undefined, que ya se
            // interpreta como vacío.
            stockActual: iStock === -1 ? undefined : valores[iStock],
            stockMinimo: iStockMin === -1 ? undefined : valores[iStockMin],
            unidad: valores[iUnidad],
          });
        });

        if (parseadas.length === 0) {
          setError("No se encontró ninguna fila con datos en este Excel.");
          setCargando(false);
          return;
        }
        setFilasPlantilla(parseadas);
      } else {
        const iDescripcion = indice("descripcion");
        const iProveedor = indice("proveedor");
        const iCodigo = indice("codigo de barra");
        const iFamilia = indice("familia");
        const iCosto = indice("costo");

        const parseadas: FilaExcelCatalogo[] = [];
        hoja.eachRow((fila, numeroFila) => {
          if (numeroFila === 1) return;
          const valores = fila.values as unknown[];
          const descripcion = String(valores[iDescripcion] ?? "").trim();
          if (!descripcion) return;
          parseadas.push({
            descripcion,
            proveedor: String(valores[iProveedor] ?? "").trim(),
            codigoBarra: valores[iCodigo] as string | number | null | undefined,
            familia: String(valores[iFamilia] ?? "").trim(),
            costo: Number(valores[iCosto] ?? 0),
          });
        });

        if (parseadas.length === 0) {
          setError("No se encontró ninguna fila con datos en este Excel.");
          setCargando(false);
          return;
        }
        setFilasCatalogo(parseadas);
      }
    } catch {
      setError("No se pudo leer este archivo. Confirmá que sea un .xlsx válido.");
    } finally {
      setCargando(false);
    }
  }

  const ejemploPrecioVenta = calcularPrecioVentaDesdeGanancia(
    1000,
    Number(porcentajeGanancia) || 0,
    incluyeIva,
    clienteConfig.reglasNegocio.ivaPorcentaje,
  );

  async function confirmarImportacion() {
    const resumen = resumenPlantilla ?? resumenCatalogo;
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
      setFilasCatalogo(null);
      setFilasPlantilla(null);
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
              <p className="text-xs text-texto-suave">
                El stock quedó en 0 para todos. La mercadería se carga después con “Ingresar mercadería”, que
                deja registrado el movimiento.
              </p>
              <div className="flex justify-end">
                <Boton type="button" variante="confirmar" onClick={cerrar}>
                  Listo
                </Boton>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2 rounded-[var(--radius-base)] border border-alerta/40 bg-alerta-fondo/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-alerta">
                  El archivo tiene que respetar este formato
                </p>
                <p className="text-xs text-texto-suave">
                  La primera fila son los encabezados, con estos nombres exactos. Las nueve columnas tienen que
                  existir; las celdas sí pueden ir vacías. Un precio escrito como texto (por ejemplo
                  <span className="numero"> 1.200 pesos</span>) hace que esa fila se rechace.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="text-texto-suave">
                      <tr>
                        <th className="py-1 pr-3 font-medium">Columna</th>
                        <th className="py-1 pr-3 font-medium">Tipo de dato</th>
                        <th className="py-1 font-medium">Si va vacía</th>
                      </tr>
                    </thead>
                    <tbody className="text-texto">
                      {FORMATO_PLANTILLA.map((fila) => (
                        <tr key={fila.columna} className="border-t border-linea/60">
                          <td className="py-1 pr-3 font-medium">{fila.columna}</td>
                          <td className="py-1 pr-3 text-texto-suave">{fila.tipo}</td>
                          <td className="py-1 text-texto-suave">{fila.siVaVacia}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-texto-suave">
                  También se acepta el formato del sistema anterior (Descripcion, Proveedor, Codigo de barra,
                  Familia, Costo). En ese caso el precio de venta no viene en el archivo y se calcula con un
                  margen que se elige acá abajo.
                </p>
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

              {cargando && !hayResumen && <p className="text-sm text-texto-suave">Leyendo {nombreArchivo}…</p>}

              {resumenPlantilla && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Estadistica etiqueta="Filas en el archivo" valor={resumenPlantilla.totalFilas} />
                    <Estadistica etiqueta="Se importan" valor={resumenPlantilla.aImportar} destacado="ok" />
                    <Estadistica
                      etiqueta="Se saltean (código ya existe)"
                      valor={resumenPlantilla.salteadasPorCodigoExistente}
                    />
                    <Estadistica etiqueta="Sin código de barras" valor={resumenPlantilla.sinCodigoBarras} />
                    <Estadistica etiqueta="Sin rubro" valor={resumenPlantilla.sinRubro} />
                    <Estadistica etiqueta="Sin proveedor" valor={resumenPlantilla.sinProveedor} />
                    <Estadistica etiqueta="Rubros nuevos" valor={resumenPlantilla.categoriasNuevas.length} />
                    <Estadistica etiqueta="Proveedores nuevos" valor={resumenPlantilla.proveedoresNuevos.length} />
                  </div>

                  {resumenPlantilla.rechazadas.length > 0 && (
                    <div className="flex flex-col gap-1 rounded-[var(--radius-base)] border border-alerta bg-alerta-fondo p-3">
                      <p className="text-xs font-semibold text-alerta">
                        {resumenPlantilla.rechazadas.length} filas se rechazan por el tipo de dato
                      </p>
                      <ul className="max-h-32 overflow-y-auto text-[11px] text-texto-suave">
                        {resumenPlantilla.rechazadas.slice(0, 40).map((fila) => (
                          <li key={fila.numeroFila}>
                            Fila <span className="numero">{fila.numeroFila}</span> · {fila.producto} — {fila.motivo}
                          </li>
                        ))}
                      </ul>
                      {resumenPlantilla.rechazadas.length > 40 && (
                        <p className="text-[11px] text-texto-suave">
                          …y {resumenPlantilla.rechazadas.length - 40} más.
                        </p>
                      )}
                      <p className="text-[11px] text-texto-suave">
                        El resto se importa igual. Corregí esas celdas en el Excel y volvé a subirlo para sumarlas.
                      </p>
                    </div>
                  )}

                  {resumenPlantilla.conStockEnElArchivo > 0 && (
                    <p className="text-xs text-texto-suave">
                      <span className="numero font-semibold">{resumenPlantilla.conStockEnElArchivo}</span> filas
                      traen stock cargado. El stock no se importa nunca: se carga con “Ingresar mercadería”, así
                      queda registrado el movimiento y el arqueo cierra.
                    </p>
                  )}
                </>
              )}

              {resumenCatalogo && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Estadistica etiqueta="Filas en el archivo" valor={resumenCatalogo.totalFilas} />
                    <Estadistica etiqueta="Se importan" valor={resumenCatalogo.aImportar} destacado="ok" />
                    <Estadistica
                      etiqueta="Se saltean (código ya existe)"
                      valor={resumenCatalogo.salteadasPorCodigoExistente}
                    />
                    <Estadistica etiqueta="Sin código de barras" valor={resumenCatalogo.sinCodigoBarras} />
                    <Estadistica etiqueta="Rubros nuevos" valor={resumenCatalogo.categoriasNuevas.length} />
                    <Estadistica etiqueta="Proveedores nuevos" valor={resumenCatalogo.proveedoresNuevos.length} />
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
                {hayResumen && (
                  <Boton
                    type="button"
                    variante="confirmar"
                    disabled={cargando || aImportar === 0}
                    onClick={confirmarImportacion}
                  >
                    {cargando ? "Importando…" : `Confirmar import (${aImportar})`}
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
