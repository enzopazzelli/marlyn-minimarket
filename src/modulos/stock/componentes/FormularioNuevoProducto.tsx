"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { clienteConfig } from "@/config/cliente";
import { Boton } from "@/componentes/Boton";
import { Campo } from "@/componentes/Campo";
import { Modal } from "@/componentes/Modal";
import { validarProducto, type ErroresProducto } from "../consultas/validacion";
import { calcularGananciaDesdePrecioVenta, calcularPrecioVentaDesdeGanancia } from "../consultas/precios";
import type { Categoria, Proveedor } from "../tipos";

const RUBRO_NUEVO = "__nuevo__";
const PROVEEDOR_NUEVO = "__nuevo__";
const IVA_PORCENTAJE = clienteConfig.reglasNegocio.ivaPorcentaje;

const clasesSelect =
  "rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-2 text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40";

// La flechita del input numérico incrementa de a "step": pesos enteros
// para precios (nadie carga centavos a mano en el mostrador) y de a 1
// para stock en unidades sueltas, pero en fracciones prácticas (100g/100ml)
// cuando el producto se pesa o se mide.
function pasoDeStock(unidad: "unidad" | "kg" | "litro") {
  return unidad === "unidad" ? "1" : "0.1";
}

function estadoInicial() {
  return {
    nombre: "",
    rubroSeleccionado: "",
    nombreRubroNuevo: "",
    proveedorSeleccionado: "",
    nombreProveedorNuevo: "",
    codigoBarras: "",
    precioCosto: "0",
    incluyeIva: true,
    porcentajeGanancia: "",
    precioVenta: "",
    stockActual: "0",
    stockMinimo: "0",
    unidad: "unidad" as "unidad" | "kg" | "litro",
  };
}

export function FormularioNuevoProducto({
  categoriasIniciales,
  proveedoresIniciales,
}: {
  categoriasIniciales: Categoria[];
  proveedoresIniciales: Proveedor[];
}) {
  const router = useRouter();
  // "Adjusting state when a prop changes" (react.dev): setState durante
  // el render, no en un efecto. useState(categoriasIniciales) por sí
  // solo únicamente toma el valor inicial; si el rubro se
  // crea/renombra/borra desde PanelRubros (otro componente), un
  // router.refresh() trae un `categoriasIniciales` nuevo por props, y
  // sin este chequeo el <select> de acá seguiría mostrando la lista
  // vieja hasta que este formulario cree un rubro por su cuenta. Mismo
  // criterio para proveedores, ahora editados/borrados desde /proveedores.
  const [categoriasVistas, setCategoriasVistas] = useState(categoriasIniciales);
  const [categorias, setCategorias] = useState(categoriasIniciales);
  if (categoriasIniciales !== categoriasVistas) {
    setCategoriasVistas(categoriasIniciales);
    setCategorias(categoriasIniciales);
  }
  const [proveedoresVistos, setProveedoresVistos] = useState(proveedoresIniciales);
  const [proveedores, setProveedores] = useState(proveedoresIniciales);
  if (proveedoresIniciales !== proveedoresVistos) {
    setProveedoresVistos(proveedoresIniciales);
    setProveedores(proveedoresIniciales);
  }
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [campos, setCampos] = useState(estadoInicial());
  const [errores, setErrores] = useState<ErroresProducto>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  function abrir() {
    setCampos(estadoInicial());
    setErrores({});
    setErrorGeneral(null);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

  // Costo, % de ganancia, IVA y precio de venta se mantienen
  // consistentes entre sí: tocar costo o precio de venta recalcula el %
  // de ganancia; tocar el % o el check de IVA recalcula el precio de
  // venta. Mismo mecanismo que producto_dialog.py en miadmin, sumando
  // el IVA como un factor más de la cuenta (pricing_service.py ahí).
  // A diferencia de Qt, un <input> controlado de React no dispara su
  // propio onChange cuando el valor cambia por props/estado, así que acá
  // no hace falta el flag anti-reentrancia que tiene la versión de Qt.
  function alCambiarCosto(valorTexto: string) {
    const ganancia = calcularGananciaDesdePrecioVenta(
      Number(valorTexto),
      Number(campos.precioVenta),
      campos.incluyeIva,
      IVA_PORCENTAJE,
    );
    setCampos({
      ...campos,
      precioCosto: valorTexto,
      porcentajeGanancia: ganancia === null ? campos.porcentajeGanancia : String(ganancia),
    });
  }

  function alCambiarVentaManual(valorTexto: string) {
    const ganancia = calcularGananciaDesdePrecioVenta(
      Number(campos.precioCosto),
      Number(valorTexto),
      campos.incluyeIva,
      IVA_PORCENTAJE,
    );
    setCampos({
      ...campos,
      precioVenta: valorTexto,
      porcentajeGanancia: ganancia === null ? campos.porcentajeGanancia : String(ganancia),
    });
  }

  function alCambiarGanancia(valorTexto: string) {
    const costo = Number(campos.precioCosto);
    const ganancia = Number(valorTexto);
    const precioVenta =
      Number.isFinite(costo) && Number.isFinite(ganancia)
        ? String(calcularPrecioVentaDesdeGanancia(costo, ganancia, campos.incluyeIva, IVA_PORCENTAJE))
        : campos.precioVenta;
    setCampos({ ...campos, porcentajeGanancia: valorTexto, precioVenta });
  }

  function alCambiarIva(marcado: boolean) {
    const costo = Number(campos.precioCosto);
    const ganancia = Number(campos.porcentajeGanancia);
    const precioVenta =
      Number.isFinite(costo) && Number.isFinite(ganancia)
        ? String(calcularPrecioVentaDesdeGanancia(costo, ganancia, marcado, IVA_PORCENTAJE))
        : campos.precioVenta;
    setCampos({ ...campos, incluyeIva: marcado, precioVenta });
  }

  async function alGuardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorGeneral(null);

    const datos = {
      nombre: campos.nombre,
      precioCosto: Number(campos.precioCosto),
      precioVenta: Number(campos.precioVenta),
      stockActual: Number(campos.stockActual),
      stockMinimo: Number(campos.stockMinimo),
    };

    const resultado = validarProducto(datos);
    setErrores(resultado.errores);
    if (!resultado.valido) return;

    if (campos.rubroSeleccionado === RUBRO_NUEVO && !campos.nombreRubroNuevo.trim()) {
      setErrorGeneral("Escribí el nombre del rubro");
      return;
    }

    if (campos.proveedorSeleccionado === PROVEEDOR_NUEVO && !campos.nombreProveedorNuevo.trim()) {
      setErrorGeneral("Escribí el nombre del proveedor");
      return;
    }

    setGuardando(true);
    const supabase = crearClienteNavegador();

    try {
      let categoriaId: string | null = null;

      if (campos.rubroSeleccionado === RUBRO_NUEVO) {
        const { data: nuevoRubro, error: errorRubro } = await supabase
          .from("categorias")
          .insert({ nombre: campos.nombreRubroNuevo.trim() })
          .select("id, nombre")
          .single();

        if (errorRubro || !nuevoRubro) {
          setErrorGeneral("No se pudo crear el rubro. Probá de nuevo.");
          return;
        }

        categoriaId = nuevoRubro.id;
        setCategorias((anteriores) =>
          [...anteriores, nuevoRubro as Categoria].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
      } else if (campos.rubroSeleccionado) {
        categoriaId = campos.rubroSeleccionado;
      }

      let proveedorId: string | null = null;

      if (campos.proveedorSeleccionado === PROVEEDOR_NUEVO) {
        const { data: nuevoProveedor, error: errorProveedor } = await supabase
          .from("proveedores")
          .insert({ nombre: campos.nombreProveedorNuevo.trim() })
          .select("id, nombre")
          .single();

        if (errorProveedor || !nuevoProveedor) {
          setErrorGeneral("No se pudo crear el proveedor. Probá de nuevo.");
          return;
        }

        proveedorId = nuevoProveedor.id;
        setProveedores((anteriores) =>
          [...anteriores, nuevoProveedor as Proveedor].sort((a, b) => a.nombre.localeCompare(b.nombre)),
        );
      } else if (campos.proveedorSeleccionado) {
        proveedorId = campos.proveedorSeleccionado;
      }

      const { error: errorProducto } = await supabase.from("productos").insert({
        nombre: datos.nombre.trim(),
        categoria_id: categoriaId,
        proveedor_id: proveedorId,
        codigo_barras: campos.codigoBarras.trim() || null,
        precio_costo: datos.precioCosto,
        precio_venta: datos.precioVenta,
        incluye_iva: campos.incluyeIva,
        porcentaje_ganancia: campos.porcentajeGanancia === "" ? null : Number(campos.porcentajeGanancia),
        stock_actual: datos.stockActual,
        stock_minimo: datos.stockMinimo,
        unidad: campos.unidad,
      });

      if (errorProducto) {
        if (errorProducto.code === "23505") {
          setErrorGeneral("Ya existe un producto con ese código de barras");
        } else {
          setErrorGeneral("No se pudo guardar el producto. Probá de nuevo.");
        }
        return;
      }

      setAbierto(false);
      router.refresh();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <Boton onClick={abrir}>+ Nuevo producto</Boton>

      <Modal titulo="Nuevo producto" abierto={abierto} onCerrar={cerrar}>
        {/* noValidate: la validación nativa del navegador (min, required)
            bloquea el submit con su propio tooltip antes de que corra
            validarProducto(), que es la que da el mensaje en criollo. */}
        <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Campo
              etiqueta="Nombre"
              id="nombre"
              value={campos.nombre}
              onChange={(evento) => setCampos({ ...campos, nombre: evento.target.value })}
            />
            {errores.nombre && <p className="text-sm text-alerta">{errores.nombre}</p>}
          </div>

          <label htmlFor="rubro" className="flex flex-col gap-1.5 text-sm">
            <span className="text-texto-suave">Rubro</span>
            <select
              id="rubro"
              className={clasesSelect}
              value={campos.rubroSeleccionado}
              onChange={(evento) => setCampos({ ...campos, rubroSeleccionado: evento.target.value })}
            >
              <option value="">Sin rubro</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
              <option value={RUBRO_NUEVO}>+ Nuevo rubro…</option>
            </select>
          </label>

          {campos.rubroSeleccionado === RUBRO_NUEVO && (
            <Campo
              etiqueta="Nombre del rubro nuevo"
              id="nombreRubroNuevo"
              value={campos.nombreRubroNuevo}
              onChange={(evento) => setCampos({ ...campos, nombreRubroNuevo: evento.target.value })}
            />
          )}

          <label htmlFor="proveedor" className="flex flex-col gap-1.5 text-sm">
            <span className="text-texto-suave">Proveedor</span>
            <select
              id="proveedor"
              className={clasesSelect}
              value={campos.proveedorSeleccionado}
              onChange={(evento) => setCampos({ ...campos, proveedorSeleccionado: evento.target.value })}
            >
              <option value="">Sin proveedor</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              ))}
              <option value={PROVEEDOR_NUEVO}>+ Nuevo proveedor…</option>
            </select>
          </label>

          {campos.proveedorSeleccionado === PROVEEDOR_NUEVO && (
            <Campo
              etiqueta="Nombre del proveedor nuevo"
              id="nombreProveedorNuevo"
              value={campos.nombreProveedorNuevo}
              onChange={(evento) => setCampos({ ...campos, nombreProveedorNuevo: evento.target.value })}
            />
          )}

          <Campo
            etiqueta="Código de barras (opcional)"
            id="codigoBarras"
            value={campos.codigoBarras}
            onChange={(evento) => setCampos({ ...campos, codigoBarras: evento.target.value })}
            className="font-[family-name:var(--font-numero)]"
          />

          <label htmlFor="unidad" className="flex flex-col gap-1.5 text-sm">
            <span className="text-texto-suave">Unidad</span>
            <select
              id="unidad"
              className={clasesSelect}
              value={campos.unidad}
              onChange={(evento) =>
                setCampos({ ...campos, unidad: evento.target.value as typeof campos.unidad })
              }
            >
              <option value="unidad">Unidad</option>
              <option value="kg">Kilogramo</option>
              <option value="litro">Litro</option>
            </select>
          </label>

          <div className="flex flex-col gap-1.5">
            <Campo
              etiqueta="Precio de costo"
              id="precioCosto"
              type="number"
              min={0}
              step="1"
              value={campos.precioCosto}
              onChange={(evento) => alCambiarCosto(evento.target.value)}
              className="font-[family-name:var(--font-numero)]"
            />
            {errores.precioCosto && <p className="text-sm text-alerta">{errores.precioCosto}</p>}
          </div>

          <label htmlFor="incluyeIva" className="flex items-center gap-2 text-sm text-texto">
            <input
              type="checkbox"
              id="incluyeIva"
              checked={campos.incluyeIva}
              onChange={(evento) => alCambiarIva(evento.target.checked)}
              className="h-4 w-4 accent-acento"
            />
            Incluye IVA ({IVA_PORCENTAJE}%)
          </label>

          {/* % de ganancia y precio de venta se retroalimentan: tocar uno
              actualiza el otro (ver alCambiarGanancia/alCambiarVentaManual). */}
          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta="% de ganancia"
              id="porcentajeGanancia"
              type="number"
              step="1"
              placeholder="Ej: 30"
              value={campos.porcentajeGanancia}
              onChange={(evento) => alCambiarGanancia(evento.target.value)}
              className="font-[family-name:var(--font-numero)]"
            />
            <div className="flex flex-col gap-1.5">
              <Campo
                etiqueta="Precio de venta"
                id="precioVenta"
                type="number"
                min={0}
                step="1"
                value={campos.precioVenta}
                onChange={(evento) => alCambiarVentaManual(evento.target.value)}
                className="font-[family-name:var(--font-numero)]"
              />
              {errores.precioVenta && <p className="text-sm text-alerta">{errores.precioVenta}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Campo
                etiqueta="Stock inicial"
                id="stockActual"
                type="number"
                min={0}
                step={pasoDeStock(campos.unidad)}
                value={campos.stockActual}
                onChange={(evento) => setCampos({ ...campos, stockActual: evento.target.value })}
                className="font-[family-name:var(--font-numero)]"
              />
              {errores.stockActual && <p className="text-sm text-alerta">{errores.stockActual}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Campo
                etiqueta="Stock mínimo"
                id="stockMinimo"
                type="number"
                min={0}
                step={pasoDeStock(campos.unidad)}
                value={campos.stockMinimo}
                onChange={(evento) => setCampos({ ...campos, stockMinimo: evento.target.value })}
                className="font-[family-name:var(--font-numero)]"
              />
              {errores.stockMinimo && <p className="text-sm text-alerta">{errores.stockMinimo}</p>}
            </div>
          </div>

          {errorGeneral && (
            <p className="rounded-[var(--radius-base)] bg-alerta-fondo px-3 py-2 text-sm text-alerta">
              {errorGeneral}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Boton type="button" variante="fantasma" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="confirmar" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar producto"}
            </Boton>
          </div>
        </form>
      </Modal>
    </>
  );
}
