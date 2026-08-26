# Mini Market Marlyn — sistema de gestión

Sistema de gestión comercial a medida para Mini Market Marlyn (minimarket
/ despensa, un solo local). Construido siguiendo
`prompt-base-sistemas-gestion.md` del repo de metodología propia:
Next.js (App Router) + Supabase (Postgres, Auth, RLS), un módulo por
carpeta, tokens de diseño en un único archivo, y seis reglas de
seguridad no negociables repasadas en cada función/vista nueva.

## Cómo levantarlo en desarrollo

1. `npm install`
2. Copiar `.env.local.example` a `.env.local` y completar las tres
   variables con las claves del proyecto Supabase.
3. Base de datos — **hosted (recomendado)**: evita instalar Docker
   Desktop, que ocupa varios GB entre la app y las imágenes del stack.
   1. Crear un proyecto gratis en [supabase.com](https://supabase.com) y
      copiar de "Project Settings → API" la URL, la `anon key` y la
      `service_role key` a `.env.local`.
   2. `npx supabase login` (una vez, abre el navegador para autenticar
      la CLI).
   3. `npx supabase link --project-ref <ref>` (el `<ref>` está en la URL
      del proyecto o en "Project Settings → General").
   4. `npx supabase db push` aplica todo `supabase/migrations/` contra
      esa base.

   Alternativa, **local con Docker** (requiere Docker Desktop con el
   motor WSL2 corriendo): `npx supabase start` levanta el stack completo
   y aplica las migraciones solo; `npx supabase db reset` las reaplica
   desde cero. Sirve para tener una base descartable que se recrea en
   segundos, a costa del espacio en disco de Docker.
4. `npm run dev` → http://localhost:3000

Scripts útiles: `npm run lint`, `npm run typecheck`, `npm run test`
(Vitest). Los tres corren en CI en cada push (`.github/workflows/ci.yml`).

## Estado actual (Núcleo, primera entrega)

Lo que ya existe: auth con Supabase (`/ingresar`), layout con barra
lateral agrupada por frecuencia de uso, tokens de diseño y tres roles
tipográficos, y migraciones de Núcleo + M1 Stock + M2 Clientes + M5 Caja
+ M3 Ventas + M6 Proveedores (catálogo) + Reportes + Pantalla al
cliente + Notas + M9 Multiusuario y Auditoría, todas con RLS activa
diferenciada por rol de usuario (funciones clave:
`registrar_venta`/`anular_venta`, `registrar_ingreso_stock`,
`registrar_movimiento_cuenta_corriente`, `importar_catalogo`).

**Ventas, Clientes, Caja, Proveedores y Reportes ya funcionan de punta a
punta**: `/ventas` es el TPV real (buscador + lector de código de barras
+ carrito + cobro en efectivo/transferencia/QR/mixto/fiado, usando
`registrar_venta`), `/clientes` tiene ficha, cuenta corriente con
recargo manual por atraso, `/caja` abre y cierra turno con arqueo,
`/proveedores` tiene ficha, productos por proveedor y genera el texto
del pedido, y `/reportes` es el dashboard del día (KPIs, ventas por
hora, medios de pago, top productos, alertas de stock) con export a
Excel, con retiros/ingresos manuales además de lo que ya deja cada
venta, y la pantalla al cliente ya conecta en vivo con la venta en
curso por Supabase Realtime. Detalle de las cinco más abajo.

**Stock ya tiene su primera pantalla real**: `/stock` lista los
productos cargados (código, rubro, precio, stock, alerta de mínimo), con
buscador y filtros por rubro/estado, y "+ Nuevo producto" da de alta un
producto, con la opción de crear un rubro nuevo al vuelo si no existe
todavía. El alta incluye una calculadora de precio (costo → % de
ganancia/IVA → precio de venta, y a la inversa si el precio se carga a
mano), portada del mismo mecanismo de `miadmin` (`producto_dialog.py` +
`pricing_service.py`) — ver `src/modulos/stock/consultas/precios.ts`.
`Modal` e `Insignia` (`src/componentes/`) nacieron acá y están pensados
para reusarse en Caja y Clientes.

**M1 Stock queda completo para esta entrega**: cada fila de la tabla
tiene "Editar" (todos los datos del producto salvo el stock — precio,
rubro, código de barras, unidad, stock mínimo) y "Ajustar stock" (ver
más abajo, reemplazo de lo que antes era solo "Ingresar"). El botón "Rubros" en la barra superior
abre alta/renombre/borrado de rubros — `PanelListaSimple.tsx`
(`src/componentes/`), componente genérico. El de "Proveedores" que
vivía acá al lado se sacó: quedó redundante en cuanto `/proveedores`
tuvo edición completa (el alta rápida al vuelo desde el `<select>` del
producto, con "+ Nuevo proveedor…", sigue igual — eso no dependía del
panel). "Exportar Excel" baja el catálogo activo a un `.xlsx` (código,
producto, rubro, proveedor, costo, precio, stock — `BotonExportarStock.tsx`,
mismo criterio que el export de `/reportes`). Decisión tomada con el
cliente sobre `BACKUP.xlsx` (ver más abajo): "Familia" del Excel es
conceptualmente lo mismo que "Rubro" acá, no una tabla aparte; "Género"
no se suma.

**Bug encontrado y corregido: `/stock` solo mostraba 1000 productos**
(2026-08-15, reportado por Enzo — el catálogo real del cliente tiene
~2991). Causa: `listarProductos()` hacía un `select()` directo, y
PostgREST corta cualquier consulta en 1000 filas (`max_rows` de
`config.toml`) sin avisar. Efecto colateral que generó la confusión:
al borrar productos basura ("asdasd", "111") que estaban dentro de
esos primeros 1000, otros productos basura que habían quedado ocultos
más allá del corte pasaban a ocupar ese lugar — daba la sensación de
que lo borrado seguía apareciendo, cuando en realidad eran filas
distintas. Corregido paginando con `.range()` hasta traer todo
(`traerTodasLasFilas()`, nuevo en `src/lib/supabase/paginado.ts` —
mismo mecanismo que ya usaba `BotonDescargarBackup.tsx`, ahora
compartido entre los dos en vez de duplicado). Como consecuencia
directa, `ListaProductos.tsx` pasó a paginar la tabla en el cliente
(de a 50, con "Página X de Y") — antes nunca hacía falta porque nunca
había más de 1000 filas para renderizar de una, ahora si hay que
mostrar cerca de 3000 sí. El checkbox "seleccionar todos" en el modo
de borrado múltiple selecciona solo la página visible, no todo lo
filtrado — con miles de filas detrás de un filtro, tildar "todos" y
borrar de una sin haber visto qué se estaba por borrar era peligroso.

**Borrar ya no se bloquea, se acomoda.** Pedido explícito de Enzo tras
usar el import de catálogo: borrar un rubro o un proveedor con
productos asignados ya no se bloquea — esos productos quedan sin ese
dato (`categoria_id`/`proveedor_id` en `null`, se ven como "—" en la
tabla). Los FKs correspondientes pasaron de `NO ACTION` (default) a
`ON DELETE SET NULL`
(`supabase/migrations/20260813210000_borrado_sin_bloqueo_y_soft_delete.sql`)
— ni `PanelListaSimple.tsx` ni `BotonEliminarProveedor.tsx` necesitaron
cambios, simplemente dejó de haber error. Un **producto** con ventas o
movimientos de stock sí necesita conservar la fila (`ventas_items.producto_id`/
`movimientos_stock.producto_id` son `not null`, borrarlo de la tabla
rompería esas ventas viejas) — ahí `eliminarProducto()`
(`src/modulos/stock/consultas/eliminarProducto.ts`) intenta el borrado
real primero y, si choca con esas dos tablas, marca el producto
`activo = false` en vez de fallar. Desde el botón "Eliminar"
(`BotonEliminarProducto.tsx`) se ve igual en los dos casos: la fila
desaparece de `/stock` y deja de poder venderse
(`PanelVentas.tsx` filtra `activo` en la búsqueda y el lector de
código) — pero en `/reportes` (detalle de ventas, top productos, Excel
exportado) y en el detalle de un fiado en `/clientes` sigue apareciendo
con el sufijo "[Eliminado]" en vez de desaparecer del historial.
"Eliminar productos" en la barra de filtros de `/stock` activa un modo
de selección múltiple (checkbox por fila) para borrar varios de una,
con el mismo criterio real/marcado por fila.

**Etiquetas de góndola** (`EtiquetasProductos.tsx`, pedido explícito de
Enzo, 2026-08-15, con captura de referencia del cliente): botón
"Etiquetas" en `/stock` — elegís productos con un buscador propio
(selector independiente del modo de selección de "Eliminar productos",
para no mezclar dos usos distintos del mismo estado), y arma una
grilla imprimible de 2 columnas × 5 filas (10 por hoja A4) con el
nombre y el precio de cada uno, grande, en el mismo estilo que la
referencia. Pensada para papel o adhesivo liso que se corta después
(decidido con Enzo, no depende de ninguna hoja pre-troquelada
puntual) — border dashed como guía de corte. Por ahora una etiqueta
por producto elegido, sin cantidad por producto — si hace falta
repetir una porque hay varias góndolas con el mismo artículo, es una
extensión chica para cuando se pida. **Sin decimales y más grande**
(pedido explícito del cliente, 2026-08-24): el precio usaba el mismo
formateador con 2 decimales que el resto de la app — en una etiqueta
",00" no suma nada y le sacaba lugar al número. `platitaEtiqueta` (sin
`minimumFractionDigits`/`maximumFractionDigits`) solo para esta
pantalla; nombre y precio subieron de tamaño (`text-lg`/`text-5xl`,
el nombre subió de nuevo a `text-xl` el 2026-08-26, pedido puntual del
cliente) para ocupar más del recuadro fijo de 95mm×55mm (ese tamaño y
la grilla 2×5 no se tocaron, ya acordados con el cliente el 2026-08-15).

**Bug encontrado y corregido: las etiquetas no se apilaban en la
hoja** (2026-08-15, reportado por Enzo con captura del diálogo de
impresión — A4 se detectaba bien, pero cada fila saltaba a una página
nueva en vez de completar las 5 de la hoja). Causa: el mecanismo de
impresión original (heredado del ticket) aislaba el contenido con
`visibility: hidden` en todo lo demás + `position: fixed; inset: 0`
en el contenedor imprimible — funciona para el ticket porque siempre
entra en una sola página chica, pero un elemento fuera de flujo
(`fixed`/`absolute`) no se pagina: lo que no entra en una página se
recorta o se pierde en vez de continuar en la siguiente. Corregido de
raíz con `CapaImpresion.tsx` (`src/componentes/`): en vez de aislar
con CSS, portalea el contenido imprimible fuera del árbol de la app
—Modal incluido— directo a `<body>`, en flujo normal de documento, que
sí pagina bien. `TicketVenta.tsx` también se migró a este mecanismo
(se renderiza dos veces con las mismas props: la copia visible dentro
del Modal, y una copia gemela portaleada que es la que
`#ticket-imprimible` aísla al imprimir) para no dejar dos técnicas de
impresión distintas conviviendo en la misma app. `page: etiquetas-a4`
(la misma "named page" de CSS Paged Media de antes) sigue resolviendo
que el ticket imprima a 80mm y las etiquetas a A4 en la misma sesión.

**"Ingresar" pasó a ser "Ajustar stock", con salida además de
entrada** (pedido explícito de Enzo, 2026-08-16: hacía falta poder
restar stock a mano — rotura, vencido, corrección de conteo — y el
campo de cantidad, con `min={0}` para el teclado numérico, no dejaba
tipear un negativo en pantallas táctiles). En vez de aceptar un número
con signo, `FormularioAjusteStock.tsx` (antes
`FormularioIngresoMercaderia.tsx`) agregó un toggle Entrada/Salida: la
cantidad que se tipea siempre es positiva, el toggle decide el signo
— mismo criterio que ya usan los botones −/+ del carrito en Ventas, y
evita el problema del teclado táctil de raíz en vez de pedir que el
cajero encuentre la tecla "-". La función `registrar_ingreso_stock`
se reemplazó por `registrar_ajuste_stock(p_producto_id, p_cantidad,
p_tipo, p_precio_venta_nuevo, p_motivo)` — `p_tipo` en
`'entrada'`/`'salida'`, guarda en `movimientos_stock` con
`tipo = 'ingreso'` o `'ajuste'` según corresponda (la columna
`cantidad` de esa tabla ya era signada desde el día 1: "negativo =
salida, positivo = entrada") y bloquea la operación si restar deja el
stock por debajo de cero, la misma regla de "sin stock negativo" que
ya rige en Ventas (`reglasNegocio.permiteStockNegativo` en
`config/cliente.ts`). `registrar_ingreso_stock` queda sin usar desde
el front pero no se borró (nadie más la llama, no hay razón para
tocar una migración ya aplicada).
**Carga rápida** (`FormularioCargaRapida.tsx`, mismo pedido): botón
nuevo al lado de "Etiquetas" para reponer varios productos seguidos
— buscador por nombre o código de barras (coincidencia exacta de
código entra directo, igual que el lector de `/ventas`), Entrada/Salida
y cantidad por producto, "Guardar y buscar el siguiente" sin cerrar el
modal. Cada producto se guarda al toque contra `registrar_ajuste_stock`,
pero la tabla de `/stock` no se refresca hasta cerrar el modal — con
~2991 productos, recargarla entera después de cada uno de 20-30
productos de un pedido se sentía lento; el stock mostrado dentro del
modal mientras tanto se actualiza con el valor que devuelve la propia
función (ahora `returns numeric` en vez de `void`), no con una consulta
aparte.

**Caja, con arqueo al cierre**: `/caja` abre un turno (monto de
apertura, insert directo — el índice único parcial de `turnos_caja` ya
impide dos turnos abiertos a la vez, no hace falta una función) y
ahora también lo cierra. Para poder arquear, `registrar_venta()` inserta
en `movimientos_caja` la parte en efectivo de cada pago (monto menos
vuelto) al confirmar una venta — antes no lo hacía y no había forma de
saber cuánto efectivo debía haber en el cajón. Con turno abierto,
`/caja` muestra "Apertura" al lado de "Debería haber" — el mismo
`montoCalculado` de `calcularEfectivoEsperado()` que antes solo se veía
adentro del modal de cierre, ahora visible todo el tiempo (con una
aclaración de que es el efectivo del cajón, no el KPI "Ventas" de
`/reportes` — son números distintos, pedido explícito de Enzo para no
confundirlos), "Ventas de este turno" (mismo listado que `/ventas`,
ver más abajo) y el botón "Cerrar caja"
(`FormularioCerrarCaja.tsx`): un modal con el monto calculado
(apertura + neto de `movimientos_caja`) y un campo editable para el
efectivo contado, precargado con el calculado; al confirmar hace un
`update` directo sobre `turnos_caja` (estado, `monto_cierre_declarado`,
`monto_cierre_calculado`, `cerrado_en`) y muestra si sobró, faltó, o
cerró justo. Debajo de "Ventas de este turno" hay una segunda lista,
"Movimientos de caja" (`ListaMovimientosCaja.tsx`, sobre
`listarMovimientosCaja`), con el detalle línea por línea de lo que ya
suma `calcularEfectivoEsperado`: cada venta en efectivo ("Venta #N"),
cada pago de cuenta corriente cobrado en efectivo ("Pago cta. cte. —
Nombre", ver Clientes abajo), y ahora también los retiros/ingresos
manuales — botón "Registrar movimiento" en el encabezado de esa misma
lista (`FormularioMovimientoCaja.tsx`), con tipo (salió/entró plata),
monto y motivo obligatorio ("¿para qué es?", para que el registro
tenga sentido después). Insert directo a `movimientos_caja`, mismo
criterio que abrir turno: una sola tabla, sin invariante que proteger
más allá de los checks de la columna (`monto > 0`, `tipo` válido). No
se valida contra el efectivo disponible — si un retiro deja la caja en
negativo, eso se ve reflejado como diferencia recién al cerrar, que es
el momento real de arqueo. "Exportar Excel" (`BotonExportarCaja.tsx`,
al lado de "Cerrar caja") arma un `.xlsx` de 3 hojas (resumen, ventas
del turno, movimientos de caja) con los mismos datos que ya están en
pantalla — a nivel turno, no día: un turno puede cruzar la medianoche,
y un día puede tener más de un turno.
**Historial de cierres** (`HistorialCierres.tsx`, pedido explícito de
Enzo, 2026-08-15 — ya estaba prometido al cliente en la cotización
original y faltaba construirlo): debajo del turno actual (esté abierto
o no), una tabla de solo lectura con los últimos 30 turnos cerrados —
día, horario, apertura, "debería haber", contado y diferencia (en
verde si sobró, en rojo si faltó, "Justo" si cerró exacto). Lectura
directa de `turnos_caja`: los montos de cierre ya quedan congelados en
la fila al cerrar (`FormularioCerrarCaja.tsx`), no hay que recalcular
nada como con el turno abierto. `listarTurnosCerrados()`
(`consultas/caja.ts`) no filtra por usuario — los dos dueños comparten
el mismo nivel de acceso, así que cualquiera ve el historial completo.

**Bug encontrado y corregido: "se cerró la caja" al cambiar de usuario**
(reportado por el cliente ya en uso, 2026-08-24). Causa real: el turno
de caja era privado por usuario (`buscarTurnoAbierto()` filtraba por
`usuario_id`) — si Admin abría la caja y después alguien entraba con
otra cuenta, esa cuenta no veía el turno de Admin y parecía cerrada,
aunque seguía abierta en la base. Confirmado con el cliente: el local
tiene un solo cajón físico, así que el turno ABIERTO pasa a ser único
para todo el local — cualquier usuario activo lo ve y lo opera, sin
importar quién lo abrió, incluidos los movimientos que registró otro
durante el mismo turno (si no, el arqueo daba mal). El historial de
turnos CERRADOS sigue siendo privado (operador ve los suyos, dueño ve
todos) — eso no cambió. Migración `20260824120000...`: el índice único
pasó de `(usuario_id) where estado='abierto'` a `((true)) where
estado='abierto'` (como mucho una fila en todo el local puede estar
abierta, sin importar quién la abrió), y las policies de select de
`turnos_caja`/`movimientos_caja` suman `estado='abierto'` (la segunda
vía un `exists()` contra `turnos_caja`, no tiene columna `estado`
propia) como condición que sola ya habilita ver el turno compartido.
De paso, un bug relacionado encontrado al mismo tiempo:
`FormularioMovimientoCaja` recibía `usuarioId={turno.usuarioId}` (quien
ABRIÓ el turno) en vez del usuario de la sesión actual — con la caja
compartida, un segundo usuario registrando un movimiento hubiera
insertado la fila a nombre de otro (choca con
`movimientos_caja_insert_propio`, que exige `usuario_id = auth.uid()`).
Al aplicar la migración había dos turnos abiertos en simultáneo en la
base real (el síntoma del bug, reproducido sin querer) — se cerró el
más nuevo con su propio monto calculado como declarado (sin fabricar
ningún sobrante/faltante), confirmado con Enzo cuál de los dos era la
caja real antes de tocarlo.

**Clientes**: `/clientes` tiene ficha (nombre, teléfono, dirección),
buscador, y por cliente "Ver cuenta" abre el historial de cuenta
corriente — cada `fiado` muestra los productos de la venta que lo
originó (fecha/producto/precio, como pidió el cliente). Pedido
específico: un recargo manual por atraso ("a la semana 5%, al mes 15 o
20%, no es una fórmula fija, es criterio nuestro") — el campo "% de
recargo" en `PanelCuentaCorriente.tsx` calcula el total, no lo decide
el sistema. `registrar_movimiento_cuenta_corriente()` (nueva función,
mismo patrón que `registrar_ingreso_stock`) aplica el recargo o
registra el pago; `'recargo'` se sumó al `check` de
`movimientos_cuenta_corriente.tipo`. También tiene "Editar"
(`FormularioEditarCliente.tsx`, al lado de "Ver cuenta") — hacía falta
porque el alta al vuelo desde el TPV (ver Ventas más abajo) solo pide
el nombre, y el teléfono/dirección se completan después desde acá.
**Registrar pago pide medio** (Efectivo/Transferencia, mismos botones
que "Cómo paga" en el TPV): si es efectivo, además de saldar la cuenta
corriente deja un ingreso en `movimientos_caja` — antes ese dinero
entraba al cajón sin quedar registrado en ningún lado, y el efectivo
esperado al cerrar caja no lo contemplaba. Pedir efectivo sin caja
abierta se bloquea (`registrar_movimiento_cuenta_corriente()` ahora
recibe `p_medio`/`p_turno_caja_id`, ambos opcionales — `'recargo'` sigue
sin pedirlos, nunca toca caja). La venta fiada original ya se ve en
`/caja` sin cambios (es una venta más de "Ventas de este turno"); el
pago posterior ahora se ve al lado, en "Movimientos de caja". Dentro de
"Ver cuenta", al lado de "Debe", el botón "Exportar"
(`BotonExportarCuentaCorriente.tsx`) arma un `.xlsx` de 2 hojas
(resumen del cliente, historial de movimientos con el detalle de
productos de cada fiado) — mismo criterio que el resto de los exports
ya construidos, `exceljs` cargado solo al hacer click. **Hora en el
historial de movimientos** (pedido del cliente, 2026-08-24): el listado
de "Ver cuenta" solo mostraba día/mes (`fechaFormateador`) — se sumó
`formatearHora()` al lado, mismo que ya usaban Ventas/Reportes.

**Actualizar precios del fiado** (pedido del cliente, 2026-08-26,
segunda opción "abajo del porcentaje" — textual: *"hay algunos clientes
que son perennes, que vienen siempre y te sacan a la semana y te pagan a
la semana; a esos ya no les ponemos porcentaje, sino que solamente le
actualizamos el precio si es que sube"*). Dentro de "Ver cuenta", debajo
del recargo por atraso, un panel "Actualizar precios": "Ver diferencias"
lista producto por producto el precio al que se lo llevó contra el
precio de hoy, y "Aplicar" suma la diferencia como un movimiento nuevo
de tipo `actualizacion` (migración `20260826100000...`). Al lado,
"Exportar comparación" (`BotonExportarComparacionPrecios.tsx`) baja el
"otro Excel" que pidió: hoja de resumen + una fila por producto con
precio que sacó / precio de hoy / diferencia / si se cobra o no.
Tres decisiones, todas documentadas también en la migración:

- **Solo suma lo que subió.** Un producto que bajó aparece en la lista y
  en el Excel (marcado "No" en "Se cobra"), pero no descuenta del saldo
  — literal a lo que pidió el dueño, y nunca cobra menos de lo pactado
  al llevarse la mercadería. El Excel muestra igual la diferencia neta a
  precio de hoy, por si algún día quiere el otro criterio.
- **Qué fiados entran: los del ciclo abierto**, o sea los posteriores a
  la última vez que la cuenta quedó en cero o a favor — exactamente el
  ciclo del cliente perenne (saca toda la semana, paga el sábado,
  arranca de nuevo). Como `saldo_cuenta_corriente` es un número corrido
  y no un historial por venta (ver la anulación bloqueada más abajo), el
  corte se reconstruye sumando los movimientos en orden; los fiados de
  ventas anuladas se excluyen de esa suma porque `anular_venta()` baja
  el saldo pero deja la fila del movimiento donde estaba.
  Un pago parcial no cierra el ciclo: la actualización sigue tomando
  todos los ítems de ese fiado, porque lo que se actualiza es el precio
  de la mercadería que se llevó, no el saldo pendiente.
- **No se cobra dos veces.** Cada actualización guarda en la columna
  nueva `movimientos_cuenta_corriente.detalle` (jsonb) el precio al que
  dejó cada producto, y la siguiente parte de ahí. Solo avanzan de base
  las filas que efectivamente se cobraron: si un producto bajó y no se
  cobró nada, su base sigue siendo la original.

El monto no viaja desde el navegador: `registrar_actualizacion_precios_fiado()`
vuelve a llamar a `calcular_actualizacion_precios_fiado()` en el momento
de aplicar (mismo criterio que `registrar_venta()` con el total). Las
dos funciones son dueño-only con su propio chequeo, no solo escondidas
en la pantalla. En ventas mixtas se actualiza únicamente la fracción que
quedó fiada (`monto del fiado / total de la venta`), y esa columna
"Parte fiada" va en el Excel. La vista `auditoria_movimientos` se
recreó para mapear el tipo nuevo (antes caía en el `else` y una
actualización se habría listado como "Fiado").

De paso, esto destapó un bug de build que ya estaba: `npm run build`
fallaba con `Module not found: Can't resolve 'rimraf'` por la cadena
`exceljs` → `unzipper` → `fstream` → `rimraf`. Los cuatro botones de
export cargan `exceljs` con `await import()` adentro del handler de
click, pero Turbopack igual lo seguía en el pase **Client Component
SSR** —que apunta a Node, no al navegador— y ahí resuelve
`exceljs.nodejs.js`, el build pesado. Venía rompiendo `/stock` en el
build desde antes; el botón nuevo lo trajo también a `/clientes`, que es
donde saltó. Arreglado con `serverExternalPackages: ["exceljs"]` en
`next.config.ts`: del lado servidor queda como require externo en vez de
bundlearse, y en el navegador se sigue usando el build de browser que
declara el `browser` field del paquete (`dist/exceljs.min.js`, cargado
en su propio chunk de ~930 KB solo al hacer click). Detalle de esta
máquina que lo hizo visible: `node_modules/rimraf` quedó como carpeta
vacía, una instalación a medias — pero aunque estuviera sana, meter
`fstream`/`unzipper` en el bundle de SSR para un export que corre en un
click era peso al pedo igual.

**Ventas (TPV)**: `/ventas` — lector de código de barras con foco fijo,
buscador con grilla de productos, carrito, y cobro en
efectivo/transferencia/débito/crédito/mixto/fiado (los medios reales de
`ventas_pagos.medio`; "mixto" arma dos filas de pago en vez de ser un
medio propio). **Débito y Crédito en vez de QR** (pedido explícito del
cliente, 2026-08-24, reemplazo total): como la base ya estaba vacía
(limpiada para la entrega) no había ningún `ventas_pagos.medio='qr'`
viejo que migrar — migración `20260824130000...` recrea el `check` de
`ventas_pagos.medio`. El select de "¿Cobrás algo ahora?" en fiado
parcial se dejó en Efectivo/Transferencia nomás, no se sumó débito/
crédito ahí todavía.

**Recargo por débito/crédito** (pedido explícito del cliente,
2026-08-24: "maneja algunos porcentajes de interés dependiendo las
tarjetas"). Confirmado con Enzo: se traslada al cliente (el total
sube) y es un % que el cajero tipea a mano en cada venta —no una tabla
fija por tarjeta/cantidad de cuotas, eso puede sumarse después si hace
falta—, mismo criterio que el recargo por atraso en cuenta corriente
(`PanelCuentaCorriente.tsx`). Al elegir Débito o Crédito en "Cómo paga"
aparece un campo "% de recargo" opcional; con algo cargado, "Cobrar"
pasa a mostrar el total con recargo y el ticket suma una línea
"Subtotal"/"Recargo X%" antes del Total (`TicketVenta.tsx`, props
nuevas `subtotal`/`recargoPorcentaje`, sin efecto si no hay recargo).
`ventas.subtotal`/`ventas.total` ya eran dos columnas separadas pero
siempre iguales — en vez de sumar una columna nueva, se usa la que
sobraba: `subtotal` = lo que valen los productos, `total` = lo que
efectivamente se cobró (`subtotal + recargo`). `registrar_venta()`
(migración `20260824140000...`) suma el parámetro `p_recargo_monto`
(default 0, ya calculado por el front) y valida los pagos contra
`total` en vez de `subtotal`. `margenBruto` en Reportes no se afecta
—se calcula solo de `ventas_items`, nunca de `total`— pero "Ventas"
(la suma de `total`) sí incluye el recargo, que es plata real cobrada
ese día. La fila de "Detalle de ventas"/"Ventas de este turno" ya
muestra el monto real por medio (ver más abajo), así que un pago con
recargo aparece con su monto ya incluido sin ningún cambio aparte.

Reusa tal cual las funciones puras ya testeadas de
`src/modulos/ventas/consultas/calculos.ts`. **Pedido del cliente:
varias ventas en curso a la vez** ("se le olvida un producto y hay que
atender a otro", "atendemos 2 clientes en la misma PC") — se resolvió
con pestañas de venta independientes (`PanelVentas.tsx`): cambiar de
pestaña es "guardar para después", la misma mecánica cubre atender dos
clientes a la vez. Se guarda en `sessionStorage` para no perder una
venta en curso ante un F5 sin querer. Al elegir "Fiado" también se
puede cargar el cliente en el momento ("+ Nuevo cliente…", mismo patrón
de alta al vuelo que Rubro/Proveedor en Stock) — se decidió así después
de que el primer diseño lo dejaba afuera a propósito y el cliente pidió
lo contrario: a veces el fiado se decide en el momento, no antes.
**Cantidades fraccionarias (kg/litro)**: `productos.unidad` ya existía
pero el carrito lo ignoraba — cada click sumaba 1 entero, sin forma de
cargar "0.350 kg" de queso. `FilaCarritoItem.tsx` separa las dos
mecánicas: productos por unidad siguen con los botones −/+ de siempre;
productos por kg/litro muestran un botón "Quitar" explícito (una
cantidad fraccionaria no tiene un "−" natural que llegue a 0) más dos
campos numéricos relacionados — gramos/mililitros (un cajero rara vez
tipea un decimal como "0.350" a mano) **y** el monto en pesos ("$2.000
de jamón" es tan común como pedir por peso). Cambiar cualquiera de los
dos recalcula el otro contra el mismo precio por kg/L; `cantidad` sigue
guardándose en kg/litro como siempre, la conversión es solo de esta
capa. No hizo falta tocar la base: `ventas_items.cantidad` ya era
numérico, era pura falta de UI. **Bug reportado por Enzo**: con menos
de 1 kg/L en góndola (ej. 0.906 kg de queso), tocar el producto para
agregarlo a la venta lo bloqueaba por completo ("no puedo vender más")
en vez de dejar cargar lo que quedaba. `agregarProducto()` en
`PanelVentas.tsx` sumaba siempre un paso fijo de 1 kg/L y comparaba eso
contra el stock — con menos de 1 disponible, ese paso ya no entraba.
Ahora, para kg/litro, el paso queda acotado a lo que realmente hay
(`Math.min(1, disponible)`): con 0.906 kg carga los 906 g de una, y el
cajero ajusta fino después con los mismos campos de gramos/monto. Por
unidad no cambia — ahí un paso de 1 siempre tuvo sentido.
**Bug encontrado y corregido (reportado por el cliente ya en uso,
2026-08-24): vender por monto no cargaba el monto exacto** — $1500 de
jamón a $18000/kg mostraba $1494. Causa real: `cantidad` se guardaba con
3 decimales de kg (`numeric(12,3)` = gramo entero); 1500/18000 = 83,333g
redondeaba a 83g × $18000 = $1494. Se ensanchó la precisión a
`numeric(14,6)` en `productos.stock_actual`/`stock_minimo`,
`ventas_items.cantidad` y `movimientos_stock.cantidad` (migración
`20260824110000...`, recreó también `registrar_venta()` —declaraba
`v_stock_disponible numeric(12,3)`— y las vistas `productos_visibles`/
`auditoria_movimientos`, que dependían del tipo de esas columnas) y
`alCambiarMonto()` en `FilaCarritoItem.tsx` dejó de redondear al gramo
en el camino monto→cantidad (`redondearFino()`, solo saca ruido de
punto flotante) — el campo de gramos se sigue mostrando redondeado a
entero para el cajero, pero la cantidad real guarda la fracción, así
que el total reconstruye el monto tipeado hasta el centavo.

**El bug seguía ahí después de ese fix** (mismo reporte, 2026-08-24
más tarde): $1500 a $18000/kg pasó a mostrar $1.499,99 en vez de
$1494 — mejor, pero seguía sin ser exacto, porque 1500/18000 =
83,333...g es una fracción periódica: ninguna precisión finita de
`cantidad` la resuelve justo. La causa de fondo no era el redondeo,
era DERIVAR el subtotal de la línea desde `cantidad × precioUnitario`
en primer lugar. Fix real (migración `20260825100000...`): el monto
tipeado pasa a ser la fuente de verdad de esa línea, no algo derivado.
`ItemCarrito`/`ItemTicket`/`ItemVentaReporte` suman un campo
`subtotal` opcional (obligatorio y ya poblado en `ventas_items.subtotal`,
que siempre existió como columna propia); `alCambiarMonto()` lo manda
como override exacto, `alCambiarTexto()` (tipear los gramos a mano) lo
limpia. `registrar_venta()` deja de recalcular el subtotal de cada
ítem — usa el que manda el front tal cual, mismo nivel de confianza
que ya existía para `precio_unitario` (tampoco se revalida contra el
catálogo). Se propagó a todo lo que antes recalculaba
`cantidad × precioUnitario` en vez de leer el subtotal real: el total
del carrito, el ticket (inmediato y el reconstruido en Reportes),
`margenBruto`, `calcularTopProductos` y la hoja "Detalle de ventas"
del Excel. De paso, se encontró y corrigió un bug de la migración
anterior (`20260824140000`, la del recargo): `create or replace
function` no reemplaza una función cuando cambia la lista de
parámetros — quedaron dos sobrecargas de `registrar_venta()`
conviviendo en la base, y cualquier llamada sin `p_recargo_monto`
explícito (como los tests) quedaba ambigua entre las dos.

**Anular una venta fiada con actividad posterior dejaba la cuenta en
negativo** (reportado por el cliente: fiado → dos recargos → un pago →
anular la venta, la cuenta terminó en -$3.770 "como si el negocio le
debiera al cliente"). Causa: `saldo_cuenta_corriente` es un número
corrido, no un historial por venta — `anular_venta()` restaba el monto
original del fiado del saldo ACTUAL sin importar qué pasó en el medio,
y un recargo calculado sobre una deuda que incluía esa venta no se
revierte proporcionalmente al anularla. Confirmado con Enzo: en vez de
arriesgar un cálculo automático sin sentido, `anular_venta()` (migración
`20260825110000...`) ahora BLOQUEA la anulación si hubo cualquier
movimiento de cuenta corriente (recargo, pago, u otro fiado) después
del fiado de esa venta — el ajuste queda para hacerlo a mano, con
criterio, desde Clientes. De paso, un bug de visualización relacionado:
un saldo negativo se mostraba como "Al día" en verde (`ListaClientes.tsx`
y `PanelCuentaCorriente.tsx` solo chequeaban `> 0`), escondiendo la
anomalía en vez de mostrarla — ahora dice "A favor $X".

**Seguimiento de ventas del turno**: las ventas confirmadas no se veían
en ningún lado después de cerrar el comprobante — `listarVentasDelTurno`
(`src/modulos/ventas/consultas/ventas.ts`) trae las ventas del turno
abierto con su medio de pago (o "Fiado — nombre del cliente") y
`ListaVentasDelTurno.tsx` las lista (número, hora, medio, total) tanto
en `/ventas` como en `/caja`, para tener el detalle a mano al arquear.
**Anular venta** (`BotonAnularVenta.tsx`, pedido explícito de Enzo,
2026-08-14): cada fila de "Ventas de este turno" que sigue confirmada
tiene un botón "Anular" — solo ahí, no desde `/reportes`, para no
tener que lidiar con reabrir el arqueo de un turno ya cerrado. Pide un
motivo obligatorio y llama a `anular_venta()` (la función ya existía
desde la primera entrega, con RLS, pero no estaba conectada a ninguna
pantalla): devuelve el stock vendido, revierte el fiado si lo hubo y
—desde la migración `20260814120000`— también descuenta de
`movimientos_caja` la parte que se había cobrado en efectivo, para que
"Debería haber" en `/caja` siga siendo correcto (antes de esa
migración, anular una venta en efectivo dejaba ese ingreso pegado en
el arqueo aunque la plata ya no estuviera realmente en el cajón). Una
venta anulada sigue viéndose en la lista, atenuada y con la insignia
"anulada" en vez del botón — no desaparece, es historial —
pero deja de contar en el resumen "N · $total" de arriba y en
`/reportes` (que ya filtraba `estado = 'confirmada'`).
**Ticket imprimible y descargable** (`src/componentes/TicketVenta.tsx` +
`AccionesTicket.tsx`, pedido explícito de Enzo, 2026-08-14): el
comprobante que ya se mostraba al confirmar una venta se separó en un
componente reusable, para poder verlo también desde el historial —
`/reportes` → "Detalle de ventas" tiene ahora un ícono de ticket por
fila que abre el mismo comprobante reconstruido con los datos que esa
tabla ya trae (no se guarda un ticket aparte). Desde cualquiera de los
dos lugares, "Imprimir" dispara la impresión nativa del navegador —
`#ticket-imprimible` queda aislado del resto de la página por una
regla `@media print` en `globals.css`, ajustada a una térmica de 80mm
(`@page { size: 80mm auto }`; cambiar ese valor si el comercio usa una
de 58mm) — y "Descargar" ofrece PNG o PDF con `html-to-image` +
`jspdf` (mismo criterio que `exceljs`: se importan recién al hacer
click). **Rediseño a solo íconos** (pedido explícito de Enzo,
2026-08-15): entre "Ver ticket", "Imprimir" y "Descargar" ya eran
varios botones con texto juntos en pantalla — ahora son íconos con
`title`/`aria-label`, y "Descargar" abre un menú chico de dos
opciones. El PDF reusa la misma captura en imagen que ya se generaba
para el PNG (`toPng` de `html-to-image`) en vez de redibujar el ticket
con la API de dibujo de `jsPDF`: la página del PDF queda del tamaño
exacto de esa imagen, sin manejar mm/DPI a mano, y no hay dos layouts
del comprobante para mantener sincronizados.

**Proveedores, módulo propio**: `/proveedores` tiene ficha (nombre,
contacto, teléfono), buscador, y por proveedor "Editar" y "Productos y
pedido". El alta rápida (solo nombre) se mantiene sin tocar en Stock
vía `PanelListaSimple`, para cargar un proveedor al vuelo mientras se
da de alta un producto; el alta completa con contacto/teléfono
(`FormularioNuevoProveedor.tsx`) y la edición
(`FormularioEditarProveedor.tsx`) viven en `/proveedores`.
"Productos y pedido" (`PanelPedidoProveedor.tsx`) filtra en el cliente
la misma lista de productos que ya trae la página (sin consulta
nueva) por `proveedor_id`, y arma un texto plano ("2 x Coca Cola 2L" o
"- Coca Cola 2L" sin cantidad) con un botón "Copiar"
(`navigator.clipboard`) — el documento para mandarle al proveedor. Esto
es catálogo de proveedores, no **M6 Compras** completo (orden de
compra/recepción formal), que sigue en `compras: false` en
`config/cliente.ts` ("Fase 2, fuera del alcance de esta entrega").
**Botón "Enviar por WhatsApp"** (pedido explícito del cliente,
2026-08-24, al lado de "Copiar"): abre `wa.me/<numero>?text=<pedido>`
con `proveedor.telefono` — oculto si el proveedor no tiene teléfono
cargado. Normalización mínima del número (`numeroWhatsapp()`): solo
dígitos, antepone "54" si no lo tiene. `telefono` es texto libre sin
formato validado y un celular argentino a veces necesita además un "9"
después del 54 que no se puede inferir de forma confiable desde 10
dígitos sin saber si es fijo o celular — documentado como límite
conocido, no resuelto: si un número no abre bien, cargarlo ya en
formato completo en `/proveedores`. **Bug encontrado y corregido**
(mismo día, reportado por el cliente): el mensaje de WhatsApp decía
"Pedido para \<Proveedor\>" — tiene sentido al copiarlo (por ejemplo,
para pegarlo en una nota propia), pero no al mandárselo al proveedor
mismo, que ya sabe que el pedido es para él. El texto de WhatsApp pasó
a ser propio (`textoWhatsapp`, separado de `textoPedido`) con
"Pedido de {clienteConfig.comercio.nombre}" en vez de "Pedido para
\<Proveedor\>" — "Copiar" no cambió.

**Reportes, dashboard del día**: `/reportes` (pedido explícito del
cliente, con un mockup propio como referencia) muestra 4 KPIs (Ventas,
Ticket promedio, Transacciones, Balance), ventas por hora, distribución
por medio de pago, top 10 productos más vendidos y alertas de stock
bajo (mismo criterio `stockActual <= stockMinimo` que Stock), todo para
un día elegido con un selector de fecha (arranca en hoy). Sin migración
nueva: todo sale de `ventas`/`ventas_items`/`ventas_pagos`/`productos`,
que ya existían. Los gráficos son `div`/Tailwind a mano, sin librería
nueva — coherente con el resto de la app — con una paleta categórica
nueva en `tema.css` (`--grafico-1` a `--grafico-4`) validada contra
daltonismo con el skill de dataviz. Botón "Exportar a Excel" arma un
`.xlsx` de 3 hojas en el navegador con `exceljs` (primer uso real de esa
dependencia, cargada solo al hacer click). **Dos cosas del pedido
original quedaron afuera a propósito**, decidido con el cliente: alertas
de vencimiento (no hay `fecha_vencimiento` en `productos`, ni pantalla
para cargarla) y una "Meta" de ventas (no hay dónde configurar un
objetivo todavía) — quedan para cuando exista esa base.
**"Alertas de stock" paginado** (`PanelAlertasStock.tsx`, pedido
explícito de Enzo, 2026-08-15): con un catálogo grande, la cantidad de
productos por debajo del mínimo puede ser larga y estirar la tarjeta
hasta el final de la pantalla. Ahora se muestran de a 8, con
"Página X de Y" y flechas para moverse — mismo criterio de paginación
en el cliente que ya usa el resto de este panel (los datos del día ya
vienen completos desde el servidor, no hay una consulta nueva por
página).
**Desglose de montos por medio en "Detalle de ventas"** (pedido
explícito del cliente, 2026-08-24): una venta mixta o un fiado parcial
mostraban solo las etiquetas ("Efectivo + Transferencia"), sin decir
cuánto fue de cada una. `medioTextoConMontos()`
(`TablaDetalleVentas.tsx`) arma "Efectivo $2.000 + Transferencia
$1.500" con más de un pago (neto de vuelto, mismo criterio que
`calcularDistribucionMedioPago`); con un solo pago no suma nada, ya está
en la columna "Total" de al lado. No hizo falta ninguna consulta nueva:
`VentaReporte.pagos` ya traía monto por pago. El ticket reconstruido
(mismo modal, "Ver ticket") se dejó con la etiqueta simple nomás —80mm
es angosto y "Vuelto"/"Queda fiado" ya dan el detalle que hace falta ahí.
**El mismo desglose se pidió también para "Ventas de este turno"**
(`/ventas` y `/caja`, mismo componente `ListaVentasDelTurno.tsx`) — a
diferencia de Reportes, `listarVentasDelTurno()` solo traía `medio` de
`ventas_pagos`, no `monto`/`vuelto`; se sumaron a la consulta. La venta
recién confirmada (antes de cualquier refetch) arma este texto en el
propio `PanelVentas.tsx` con los mismos `pagos` que se acaban de
mandar a `registrar_venta()` — tiene su propia copia de la lógica
(comentario ahí explica por qué: si mostrara solo las etiquetas, la
fila se vería distinta apenas hubiera un refetch real).

**Backup manual** (`BotonDescargarBackup.tsx`, al lado de "Exportar a
Excel", pedido explícito de Enzo, 2026-08-14): baja un `.xlsx` con una
hoja por tabla (categorías, productos, proveedores, clientes, turnos y
movimientos de caja, ventas + ítems + pagos, movimientos de stock y de
cuenta corriente) — a diferencia del resto de los exports, esto es un
respaldo para archivar, no un reporte curado. Pagina con `.range()` en
vez de un `select("*")` directo: PostgREST corta cualquier consulta en
1000 filas (`max_rows` de `config.toml`) aunque no se pida un
`.limit()`, así que sin eso el catálogo real del cliente (~2991
productos) se hubiera truncado a los primeros 1000 sin ningún error
visible. Es manual y bajo demanda, no un backup automático recurrente —
`perfiles` (cuentas de operador, no datos del negocio) queda afuera a
propósito, salvo columnas explícitas sin `token_pantalla`.

**Backup legible** (`backupLegible.ts`, pedido explícito de Enzo,
2026-08-19): toda columna que sea FK a otra tabla (`categoria_id`,
`proveedor_id`, `cliente_id`, `usuario_id`, `venta_id`, `turno_id`) se
resuelve a nombre/etiqueta legible en vez de quedar como uuid crudo — el
`id` propio de cada fila no se toca. Un id que no aparece en su mapa se
marca `(no encontrado)` en vez de quedar en blanco silenciosamente.

**Reimportar backup** (`FormularioReimportarBackup.tsx` +
`reimportar_maestros()`, mismo pedido): botón dueño-only al lado del de
descarga, para volver a subir el mismo Excel después de editarlo a mano.
Solo `categorias`, `proveedores`, `productos` y `clientes` son
reimportables (upsert por `id`: sin id da de alta, con id existente
edita, con id que no existe es error explícito por fila — nunca borra lo
que falte en la hoja). Las tablas transaccionales/derivadas (`ventas`,
pagos, movimientos de stock/caja/cuenta corriente, turnos) y `notas`
siguen siendo de un solo sentido — legibles pero no reimportables: cada
escritura ahí hoy pasa por una función `security definer`
(`registrar_venta`/`anular_venta`/`registrar_ajuste_stock`/
`registrar_movimiento_cuenta_corriente`) que mantiene consistentes
stock, caja y cuenta corriente en un solo paso atómico, y reconstruir
esas tablas desde un Excel editado a mano tiraría eso por la borda — ni
hay demanda real de "editar ventas históricas en Excel y resubirlas". La
función nunca toca `productos.stock_actual` ni
`clientes.saldo_cuenta_corriente` (estado derivado que solo mantienen
las funciones de arriba, junto con su fila de auditoría) — ni siquiera
lee esas claves del jsonb que recibe. `categorias`/`proveedores`
necesitaron un `unique(lower(nombre))` nuevo para que el nombre resuelva
sin ambigüedad al reimportar (migración
`20260819140000_nombres_unicos_categorias_proveedores.sql`, fusiona
duplicados existentes antes de agregar la restricción — no hizo falta
fusionar nada en la base real). `productos.nombre`/`clientes.nombre`
deliberadamente **no** llevan esa restricción: nada reimportable resuelve
un FK a través de esos nombres (el upsert de esas dos tablas usa su
propio `id`), y forzar unicidad sobre ~2400 productos reales sin
beneficio real hubiera exigido un merge manual innecesario.

Si alguna vez hace falta una restauración de desastre real (no edición
en Excel) de las tablas transaccionales, eso es trabajo de backups
nativos de Postgres (Supabase Point-in-Time Recovery, plan pago, o
`pg_dump`/`pg_restore`), no de este botón.

**Bug de hidratación al mostrar la hora, encontrado y corregido**
(2026-08-14): React tiraba "Hydration failed" en `/reportes` (y latente
en cualquier otra pantalla con hora en una tabla). Causa:
`Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" })`
separa "a. m."/"p. m." con un carácter de espacio que varía según el
motor ICU (normal, non-breaking, narrow no-break) — el Node del
servidor y el V8 del navegador no siempre coinciden, mismo horario,
bytes distintos. `formatearHora()` (`src/lib/formato.ts`) normaliza
esos espacios después de formatear; reemplaza el `Intl.DateTimeFormat`
inline en los cuatro lugares que renderizan hora directo en el DOM
(`ListaVentasDelTurno.tsx`, `TablaDetalleVentas.tsx`,
`ListaMovimientosCaja.tsx`, `caja/page.tsx`). Los dos usos que solo
escriben a Excel (`BotonExportarExcel.tsx`, `BotonExportarCaja.tsx`) no
lo necesitan, ahí no hay hidratación de por medio.

**Notas, módulo nuevo** (`/notas`, pedido explícito de Enzo,
2026-08-14): lista de notas sueltas de texto libre con fecha
automática, sin título ni categoría — para cualquier uso, desde pegar
el pedido que se le mandó a un proveedor hasta un recordatorio
cualquiera. El formulario de alta queda siempre visible arriba de la
lista (no en un modal): la idea es poder pegar algo rápido. Tabla
`notas` con RLS directa, mismo criterio que `movimientos_caja` (sin
función `security definer`, no hay ningún invariante que proteger más
allá del `check` de que el texto no quede vacío). Se sumó a
`BotonDescargarBackup.tsx`. De paso, encontrado al sumar `notas` ahí:
ese backup nunca sanitizaba el texto libre que vuelca (nombres,
motivos, y ahora el texto de una nota) contra CSV/Formula Injection —
regla 5 de `prompt-base-sistemas-gestion.md`, que ya estaba escrita
pero no se había aplicado en ningún export de este proyecto. Corregido
con `filaSegura()`/`celdaSegura()` (`src/lib/excel.ts`), que prefija
con una comilla cualquier celda que empiece con `=`, `+`, `-` o `@`
—aplicado solo en el backup por ahora; los otros exports (Stock, Caja,
cuenta corriente, Reportes) tienen el mismo hueco pendiente, sin
resolver todavía.

**M9 Multiusuario y Auditoría** (pedido explícito del dueño, vía Enzo,
2026-08-18 — ver `perfiles.rol` en Núcleo, que ya venía preparado para
esto sin reescribir nada): dos roles, `dueño` y `operador` ("Empleado"
en pantalla). El motivador concreto: poder darle acceso a un empleado
sin que vea cuánto gana el negocio por producto, y poder revisar
después si algo raro pasó (un ajuste de stock con un motivo que no era
cierto, un recargo aplicado sin que correspondiera).

*Qué ve/hace un operador, a diferencia del dueño*: no ve `precio_costo`
en ningún lado (Stock, calculadora, Excel — una vista,
`productos_visibles`, se lo devuelve `null`, no es solo un recorte de
la pantalla) ni tiene acceso a `/reportes`. No puede crear/editar/
eliminar productos, rubros ni proveedores (sí puede "Ajustar stock" y
"Carga rápida" — el día a día de reponer y corregir conteos — pero sin
tocar el precio de venta desde ahí). No puede aplicar un recargo por
atraso. Ve el turno de caja ABIERTO igual que el dueño (es un solo
cajón físico compartido por todo el local, ver más abajo) — de los
CERRADOS (historial), solo los que abrió/cerró él mismo, no los de otro
usuario. Puede vender, cobrar, cargar clientes, anular una
venta del turno y usar Proveedores de solo lectura ("Productos y
pedido") igual que el dueño — la anulación de venta no se restringió a
propósito: ya exigía motivo y ya guardaba quién fue desde antes, así
que auditar alcanza, no hacía falta bloquearla.

*Cómo se armó, capa por capa* (`PLAN-ROLES-AUDITORIA.md`, borrado una
vez que esto se escribió acá): la RLS de cada tabla es la barrera real
(varias policies `for select`/`insert`/`update`/`delete` en vez de la
única `for all` que alcanzaba cuando no había diferencia de rol —
Postgres no deja combinar comandos en un mismo `for`), no las pantallas
— eso es solo para no mostrarle a un operador un botón que le va a
fallar al tocarlo (`PerfilContext.tsx`, `usePerfil()`/`useEsDueño()`,
sembrado una vez en `(app)/layout.tsx` para que cualquier componente
pregunte el rol sin prop-drilling manual a través de cada página).
`movimientos_caja` no guardaba quién hacía un retiro/ingreso manual —
se sumó `usuario_id`, con un `check` que impide que alguien lo grabe a
nombre de otro usuario. **Primeras Server Actions del proyecto**
(`crearOperador()`/`restablecerContraseña()`, en `/usuarios`): dar de
alta un usuario o resetearle la contraseña son operaciones de
`auth.admin`, que no existen como función SQL — necesitan la clave de
servicio (`src/lib/supabase/admin.ts`, detrás del paquete `server-only`
para que el build falle si algún componente de cliente la importa por
error) y, a diferencia de todo lo demás en este proyecto, no tienen una
RLS de respaldo si el chequeo de "sos dueño" tuviera un agujero.

**Usuarios** (`/usuarios`, dueño-only): alta de un empleado (nombre,
correo, contraseña inicial — se le pasa directo, no hay envío de mail),
activar/desactivar (alcanza con `perfiles.activo`, que ya gatea todo el
sistema desde Núcleo) y restablecer contraseña. No se puede tocar la
propia cuenta desde acá, para no poder auto-bloquearse.

**Auditoría** (`/auditoria`, dueño-only): una vista,
`auditoria_movimientos`, une `movimientos_stock` +
`movimientos_cuenta_corriente` + `movimientos_caja` + ventas anuladas +
cierres de turno en una sola lista (fecha, usuario, tipo, detalle,
monto), con su propio `where auth_rol() = 'dueño'` — ninguna de esas
cinco tablas tiene una policy dueño-only en `select` (el operador las
necesita para operar), así que sin ese filtro la vista se lo mostraría
igual. Un cierre de turno con diferencia negativa (faltante) queda
como su propio ítem, con el monto de la diferencia — no fue pedido
puntualmente, pero es la señal más directa de un patrón sospechoso por
usuario, y sale del mismo dato que ya se guardaba. Filtros por fecha
(contra el servidor), usuario y tipo (en el cliente), insignia de color
en lo que conviene revisar (salida de stock, recargo, retiro de caja,
venta anulada, cierre con faltante), y export a Excel de lo que esté
filtrado en pantalla — con `filaSegura()` desde el primer commit (no
como deuda pendiente): la columna "Detalle" lleva motivos/notas de
texto libre, mismo hueco de CSV/Formula Injection que las Notas ya
habían encontrado en el backup. `BotonDescargarBackup.tsx` también suma
`auditoria_movimientos` y `perfiles` (esta última con columnas
explícitas, sin `token_pantalla`, que sigue siendo sensible).

**Bug encontrado de paso, no relacionado a lo anterior** (reportado por
Enzo al cobrar una venta real, 2026-08-18): `registrar_venta()` empezó
a fallar con "column reference \"id\" is ambiguous" — la migración
anterior (`20260817090000`) había cambiado su retorno a `returns
table(id, numero, creado_en)`, y esas columnas de salida quedan
declaradas como variables en toda la función; cualquier
`id`/`numero`/`creado_en` sin calificar en el cuerpo pasó a ser ambiguo
contra las columnas homónimas de `productos`/`ventas`/`clientes`. No se
veía al crear la función, solo al ejecutarla. Corregido calificando
cada referencia con su tabla.

**Fiado parcial** (pedido explícito de Enzo, 2026-08-19: "no siempre se
fía el monto total"; ampliado el mismo día a pedido suyo para admitir
cualquier medio, no solo efectivo): en el flujo de "Fiado" de
`/ventas`, un campo opcional "¿Cobrás algo ahora?" con su propio
selector de medio (Efectivo/Transferencia/QR) — lo que se carga ahí se
cobra en el momento, el resto queda en la cuenta corriente del cliente.
Cambio solo de front (`PanelVentas.tsx`): `registrar_venta()` ya
aceptaba varias filas de pago con cualquier combinación de medios (así
arma "Mixto" desde el día 1), así que un pago
`[{<medio elegido>, X}, {fiado, total-X}]` ya funcionaba en la base sin
tocar nada — dejar el campo vacío sigue siendo fiar el 100%, exactamente
como antes. El ticket lo deja explícito ("Transferencia + Fiado" en vez
de "Fiado" a secas, más una línea "Queda fiado" con el monto) para que
no se preste a confusión sobre cuánto quedó pendiente y en qué se cobró.

**Bug encontrado y corregido: después de cobrar, había que clickear la
pestaña "Venta 1" para poder seguir vendiendo** (reportado por Enzo,
2026-08-19). Causa: `cerrarVenta()` (`PanelVentas.tsx`), al confirmar una
venta con una sola pestaña abierta, creaba un carrito nuevo pero nunca
actualizaba `carritoActivoId` para que apuntara a él — la pestaña
quedaba pintada como inactiva, y `actualizarCarritoActivo()` (que filtra
por ese id) no encontraba ningún carrito para actualizar, así que tocar
un producto no hacía nada hasta clickear la pestaña a mano. Corregido
llamando `setCarritoActivoId()` también en esa rama.

**Supuesto de "Balance"**: es margen bruto (ventas − costo de
mercadería vendida), calculado con el `precio_costo` ACTUAL de cada
producto — no se guarda un histórico de costo por venta, así que si el
costo de un producto cambió después de venderlo hoy, el balance de hoy
ya refleja el costo nuevo, no el que tenía al momento de la venta.

**Supuesto sin confirmar con el cliente**: el checkbox "Incluye IVA" de
la calculadora arranca destildado (pedido explícito de Enzo,
2026-08-14 — la mayoría de los productos no lo necesita) y de tildarse
usa 21% (`config/cliente.ts`, `reglasNegocio.ivaPorcentaje`) — no está
confirmado si Mini Market Marlyn factura como responsable inscripto o
si ese 21% aplica igual a todo su catálogo (ej. alimentos de la
canasta básica suelen tener otra alícuota). Es una ayuda para cargar
precios más rápido, no afecta el ticket (que sigue sin discriminar
IVA).

**Las migraciones SQL ya se corrieron contra una base real** (Supabase
local vía Docker, `supabase db reset`): las 5 migraciones de Núcleo + M1
Stock + M2 Clientes + M5 Caja + M3 Ventas aplican sin errores, las 11
tablas quedan creadas con RLS habilitado, y las funciones
`registrar_venta`/`anular_venta` existen con la firma esperada. Falta
todavía probarlas con datos reales (una venta de punta a punta) una vez
que existan las pantallas.

**Pantalla al cliente, en vivo.** `/pantalla-cliente` (dentro de la app,
con sesión) muestra un link fijo para emparejar la TV del mostrador —
`token_pantalla` vive en `perfiles` (una columna nueva, `uuid default
gen_random_uuid()`), no en el turno, así que se configura una vez y
sigue funcionando aunque se abra y cierre la caja todos los días.
`/pantalla/[token]` (fuera de `(app)`, sin sesión — por diseño, la TV
nunca inicia sesión) resuelve el token con `resolver_pantalla()`, una
función pública (`grant execute ... to anon`, la primera de este
proyecto pensada para que la llame un visitante sin login) que solo
expone a qué dueño pertenece un token, nada de datos del negocio. El
carrito en sí viaja por **Supabase Realtime Broadcast** — un canal
`pantalla:<token>` — en vez de una tabla: la venta en curso ya es
puramente client-side (`sessionStorage`) hasta que `registrar_venta()`
la confirma, así que transmitirla por un canal efímero encaja mejor
que modelarla en Postgres. `PanelVentas.tsx` emite `{items, total}` de
la pestaña activa cada vez que cambia (agregar/sacar productos, cambiar
de "Venta 1" a "Venta 2" — la pantalla sigue lo que el cajero tiene
seleccionado, pedido explícito para cuando hay varias ventas en curso
a la vez); `PantallaEnVivo.tsx` escucha y pinta la lista de productos +
el total grande en `--acento`, el token que `tema.css` ya tenía
reservado para esto desde el día 1. **Bug encontrado y corregido**
(reportado por el cliente con foto de la TV, 2026-08-26): un nombre
largo ("CABALLA AL NATURAL /EN ACEITE Y EN AGUA CARACAS 380GR")
envolvía a una segunda línea — como la fila es un flex con
`items-baseline`, el precio quedaba alineado con la altura de la
PRIMERA línea del nombre en vez de acompañarlo. `tamañoTextoItem()`
(`pantalla/consultas/formato.ts`) achica la clase de Tailwind de la
fila según la longitud del nombre, para que términos largos entren en
una sola línea — cortes heurísticos por cantidad de caracteres, no una
medición real del ancho renderizado (no hay forma barata de eso en
este componente); si algún nombre real sigue sin entrar, ajustar esos
números primero.

**Buscador: "cualquier palabra, en cualquier orden"** (pedido
explícito del cliente, 2026-08-26 — acostumbrado al sistema anterior,
donde buscar "GOM ACID" encontraba "GOMITA MOGUL ACIDAS-DIENTE"; acá no
encontraba nada). Los buscadores de Ventas, Stock, Etiquetas, Carga
rápida, Proveedores y Clientes comparaban el término completo como una
sola subcadena contra el nombre (`nombre.includes(termino)`) — ahora
usan `coincideBusqueda()` (`src/lib/busqueda.ts`, función pura con
tests): separa el término en palabras y exige que cada una aparezca en
algún lado del texto, sin importar el orden ni que sean contiguas. Los
campos que no son nombres (código de barras, teléfono) se dejaron con
`includes()` simple — no tiene sentido tokenizar un número.

## Supuestos tomados (a confirmar con el cliente)

- Un solo local, un solo turno de trabajo por vez. Dos roles (`dueño` y
  `operador`/"Empleado", M9 Multiusuario — ver más arriba): los dueños
  siguen compartiendo el mismo acceso completo entre sí, un empleado
  tiene acceso acotado.
- Internet estable en el local → sin offline-first en esta etapa.
- Fiado: se registra en la cuenta corriente del cliente, sin límite que
  bloquee la venta (`reglasNegocio.limiteFiadoDuroActivo = false`).
- Pago mixto: incluido como caso real, no opcional.
- Sin integración con ninguna pasarela de pago (transferencia/QR se
  registran como "cobrado", sin conciliación automática).
- Facturación fiscal: **fuera de alcance**, ya conversado con el
  cliente. El comprobante es un ticket no fiscal.
- Sin stock negativo: si no hay stock cargado, no se puede vender
  (`reglasNegocio.permiteStockNegativo = false`).
- Sin logo ni paleta propia todavía: se usa la paleta por defecto del
  sistema (verde tinta + amarillo cartel) en `src/estilos/tema.css`.
- Facturación fiscal queda para una segunda etapa (decidido con el
  cliente). El botón "Imprimir" del ticket (ver más arriba) es
  impresión nativa del navegador, no una integración dedicada con la
  térmica (ESC/POS) — funciona si la impresora está instalada como
  impresora normal de Windows, que es el caso más común; una
  integración de bajo nivel sigue quedando para una segunda etapa si
  hiciera falta. El complemento de pantalla al cliente sí entra en esta
  entrega, a pedido explícito del cliente.

## Preguntas todavía abiertas

- Monto de apertura de caja: ¿se carga a mano cada vez, o suele ser
  siempre el mismo importe?
- ¿Redondeo de precios/totales, o todo a centavos exactos?
- Confirmar si hay cajonera electrónica de verdad (el cliente dijo
  "creo que sí") — no bloquea nada de esta entrega, pero condiciona el
  complemento de impresión en la segunda etapa.
- ~~`codigo_barras` es `unique`...~~ resuelto — ver "Excel" abajo.
- ~~`Familia` (511 valores...~~ resuelto — ver "Excel" abajo.

## Excel: import de catálogo y export de reportes (los dos construidos)

Pedido del cliente, con `BACKUP.xlsx` (raíz del repo, no versionado) como
dato real de referencia: un export de ~2991 productos de su sistema
anterior. Columnas: `Descripcion`, `Proveedor`, `Codigo de barra`,
`Familia`, `Costo`, `Codigo` (interno, correlativo del sistema viejo,
no se usa). Alcance pedido: import de catálogo (altas masivas a
`productos`) y export de reportes — los dos con `exceljs`.

**Export** (`/reportes`, ver más arriba): botón "Exportar a Excel" arma
un `.xlsx` de 4 hojas (resumen, medios de pago, top productos, detalle
de ventas) del día elegido.

**Import** (`/stock`, botón "Importar Excel",
`FormularioImportarExcel.tsx`): sube cualquier `.xlsx` con esas mismas
columnas (no hace falta que sea `BACKUP.xlsx` puntual — busca las
columnas por nombre de encabezado, no por posición). Decidido con el
cliente sobre los dos puntos que quedaban abiertos:

- **Código de barras placeholder → `null`, no bloquea el import.**
  Inspeccionado el archivo real: 1048 filas con `"0"` sola, más 297 con
  patrones de dígito repetido (`"11111111"`, `"4444444444"`, etc.) — no
  son colisiones reales, son productos pesados/sueltos del sistema
  viejo. `esCodigoBarrasPlaceholder()` en
  `src/modulos/stock/consultas/importarExcel.ts` los detecta
  (`/^(\d)\1*$/`) y esas filas entran con `codigo_barras = null`, que
  `unique` sí admite en múltiples filas. De paso: 37 filas más tienen un
  código *real* pero duplicado dentro del propio archivo — la primera
  aparición se queda con el código, las siguientes entran sin él (dos
  filas con el mismo código en el mismo insert rompería `unique`).
- **`Familia` se normaliza antes de crear rubros** (trim + Title Case),
  para que `"VARIOS"`/`"Varios"`/`"varios "` terminen siendo un solo
  rubro en vez de tres — contados en el archivo real, son 483 rubros
  distintos después de normalizar (no ~511, esa cifra era una
  estimación a mano de antes de tener el import construido). Mismo
  criterio aplicado a `Proveedor` (65 distintos), aunque no fue pedido
  explícito, por el mismo tipo de problema.
- **El Excel no trae precio de venta ni stock.** El precio de venta se
  calcula como costo × margen (% elegido en el momento del import, con
  IVA opcional) usando `calcularPrecioVentaDesdeGanancia()` — la misma
  fórmula de la calculadora del alta manual
  (`stock/consultas/precios.ts`), no una nueva. El stock arranca en 0
  para todo lo importado; el conteo físico se carga después, producto
  por producto, como ya se hacía.
- **Si el código de barras ya existe en la base, la fila se saltea**
  (no se pisa ni se duplica) — para no arrastrarse por encima de
  productos que ya se cargaron o editaron a mano.

Todo el cálculo (qué se importa, qué se saltea, qué rubros/proveedores
son nuevos, el precio de venta) es una función pura
(`construirImportacion`, con tests en `importarExcel.test.ts`) — el
componente solo parsea el archivo y llama a una única función
transaccional en la base, `importar_catalogo()`
(`supabase/migrations/20260813200000_importar_catalogo.sql`, mismo
criterio que `registrar_venta()`: con miles de filas, todo-o-nada).
