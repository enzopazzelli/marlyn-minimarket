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
import type { Categoria, Producto, Proveedor } from "../tipos";

// Mismo mecanismo que FormularioNuevoProducto.tsx (costo/%/IVA/venta
// retroalimentándose, alta de rubro al vuelo) pero editando en vez de
// insertar. Se duplica en vez de compartir un hook, misma decisión que
// tomó miadmin con producto_dialog.py / producto_edit_dialog.py: son
// archivos separados con la misma lógica repetida, no una base común.
//
// A diferencia del alta, acá NO hay campo de stock inicial: el stock ya
// cargado solo cambia por movimientos con motivo (ver
// FormularioAjusteStock.tsx), nunca por una edición directa.

const RUBRO_NUEVO = "__nuevo__";
const PROVEEDOR_NUEVO = "__nuevo__";
const IVA_PORCENTAJE = clienteConfig.reglasNegocio.ivaPorcentaje;

const clasesSelect =
  "rounded-[var(--radius-base)] border border-linea bg-superficie px-3 py-2 text-texto outline-none focus-visible:border-acento focus-visible:ring-2 focus-visible:ring-acento/40";

function pasoDeStock(unidad: "unidad" | "kg" | "litro") {
  return unidad === "unidad" ? "1" : "0.1";
}

function estadoDesdeProducto(producto: Producto) {
  return {
    nombre: producto.nombre,
    rubroSeleccionado: producto.categoriaId ?? "",
    nombreRubroNuevo: "",
    proveedorSeleccionado: producto.proveedorId ?? "",
    nombreProveedorNuevo: "",
    codigoBarras: producto.codigoBarras ?? "",
    precioCosto: String(producto.precioCosto),
    incluyeIva: producto.incluyeIva,
    porcentajeGanancia: producto.porcentajeGanancia === null ? "" : String(producto.porcentajeGanancia),
    precioVenta: String(producto.precioVenta),
    stockMinimo: String(producto.stockMinimo),
    unidad: producto.unidad,
  };
}

export function FormularioEditarProducto({
  producto,
  categoriasIniciales,
  proveedoresIniciales,
}: {
  producto: Producto;
  categoriasIniciales: Categoria[];
  proveedoresIniciales: Proveedor[];
}) {
  const router = useRouter();
  // "Adjusting state when a prop changes" (react.dev): setState durante
  // el render, no en un efecto — ver el mismo comentario en
  // FormularioNuevoProducto.tsx.
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
  const [campos, setCampos] = useState(estadoDesdeProducto(producto));
  const [errores, setErrores] = useState<ErroresProducto>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  function abrir() {
    setCampos(estadoDesdeProducto(producto));
    setErrores({});
    setErrorGeneral(null);
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
  }

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
      // validarProducto pide stockActual, pero acá no se edita: se
      // manda el valor actual del producto solo para pasar el chequeo,
      // no viaja en el update.
      stockActual: producto.stockActual,
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

      const { error: errorProducto } = await supabase
        .from("productos")
        .update({
          nombre: datos.nombre.trim(),
          categoria_id: categoriaId,
          proveedor_id: proveedorId,
          codigo_barras: campos.codigoBarras.trim() || null,
          precio_costo: datos.precioCosto,
          precio_venta: datos.precioVenta,
          incluye_iva: campos.incluyeIva,
          porcentaje_ganancia: campos.porcentajeGanancia === "" ? null : Number(campos.porcentajeGanancia),
          stock_minimo: datos.stockMinimo,
          unidad: campos.unidad,
        })
        .eq("id", producto.id);

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
      <button
        type="button"
        onClick={abrir}
        className="text-xs font-medium text-texto-suave underline decoration-dotted underline-offset-2 hover:text-texto"
      >
        Editar
      </button>

      <Modal titulo={`Editar ${producto.nombre}`} abierto={abierto} onCerrar={cerrar}>
        <form onSubmit={alGuardar} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Campo
              etiqueta="Nombre"
              id={`nombre-${producto.id}`}
              value={campos.nombre}
              onChange={(evento) => setCampos({ ...campos, nombre: evento.target.value })}
            />
            {errores.nombre && <p className="text-sm text-alerta">{errores.nombre}</p>}
          </div>

          <label htmlFor={`rubro-${producto.id}`} className="flex flex-col gap-1.5 text-sm">
            <span className="text-texto-suave">Rubro</span>
            <select
              id={`rubro-${producto.id}`}
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
              id={`nombreRubroNuevo-${producto.id}`}
              value={campos.nombreRubroNuevo}
              onChange={(evento) => setCampos({ ...campos, nombreRubroNuevo: evento.target.value })}
            />
          )}

          <label htmlFor={`proveedor-${producto.id}`} className="flex flex-col gap-1.5 text-sm">
            <span className="text-texto-suave">Proveedor</span>
            <select
              id={`proveedor-${producto.id}`}
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
              id={`nombreProveedorNuevo-${producto.id}`}
              value={campos.nombreProveedorNuevo}
              onChange={(evento) => setCampos({ ...campos, nombreProveedorNuevo: evento.target.value })}
            />
          )}

          <Campo
            etiqueta="Código de barras (opcional)"
            id={`codigoBarras-${producto.id}`}
            value={campos.codigoBarras}
            onChange={(evento) => setCampos({ ...campos, codigoBarras: evento.target.value })}
            className="font-[family-name:var(--font-numero)]"
          />

          <label htmlFor={`unidad-${producto.id}`} className="flex flex-col gap-1.5 text-sm">
            <span className="text-texto-suave">Unidad</span>
            <select
              id={`unidad-${producto.id}`}
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
              id={`precioCosto-${producto.id}`}
              type="number"
              min={0}
              step="1"
              value={campos.precioCosto}
              onChange={(evento) => alCambiarCosto(evento.target.value)}
              className="font-[family-name:var(--font-numero)]"
            />
            {errores.precioCosto && <p className="text-sm text-alerta">{errores.precioCosto}</p>}
          </div>

          <label htmlFor={`incluyeIva-${producto.id}`} className="flex items-center gap-2 text-sm text-texto">
            <input
              type="checkbox"
              id={`incluyeIva-${producto.id}`}
              checked={campos.incluyeIva}
              onChange={(evento) => alCambiarIva(evento.target.checked)}
              className="h-4 w-4 accent-acento"
            />
            Incluye IVA ({IVA_PORCENTAJE}%)
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta="% de ganancia"
              id={`porcentajeGanancia-${producto.id}`}
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
                id={`precioVenta-${producto.id}`}
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

          <div className="flex flex-col gap-1.5">
            <Campo
              etiqueta="Stock mínimo"
              id={`stockMinimo-${producto.id}`}
              type="number"
              min={0}
              step={pasoDeStock(campos.unidad)}
              value={campos.stockMinimo}
              onChange={(evento) => setCampos({ ...campos, stockMinimo: evento.target.value })}
              className="font-[family-name:var(--font-numero)]"
            />
            {errores.stockMinimo && <p className="text-sm text-alerta">{errores.stockMinimo}</p>}
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
              {guardando ? "Guardando…" : "Guardar cambios"}
            </Boton>
          </div>
        </form>
      </Modal>
    </>
  );
}
