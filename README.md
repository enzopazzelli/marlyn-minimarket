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
tipográficos, migraciones de Núcleo + M1 Stock + M2 Clientes + M5 Caja +
M3 Ventas (con RLS y las funciones `registrar_venta`/`anular_venta`).

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
rubro, código de barras, unidad, stock mínimo) e "Ingresar" (sumar stock
a uno existente con motivo, vía la función `registrar_ingreso_stock`,
que además dejó un movimiento en `movimientos_stock` con
`tipo = 'ingreso'` para no perder el historial — el stock cargado nunca
se pisa con un update directo). El botón "Rubros" en la barra superior
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
ya construidos, `exceljs` cargado solo al hacer click.

**Ventas (TPV)**: `/ventas` — lector de código de barras con foco fijo,
buscador con grilla de productos, carrito, y cobro en
efectivo/transferencia/QR/mixto/fiado (los medios reales de
`ventas_pagos.medio`; "débito" del mockup no está soportado por el
esquema, "mixto" arma dos filas de pago en vez de ser un medio propio).
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
de 58mm) — y "Descargar" lo baja como `.png` con `html-to-image`
(mismo criterio que `exceljs`: se importa recién al hacer click).

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

**Backup manual** (`BotonDescargarBackup.tsx`, al lado de "Exportar a
Excel", pedido explícito de Enzo, 2026-08-14): baja un `.xlsx` con una
hoja por tabla (categorías, productos, proveedores, clientes, turnos y
movimientos de caja, ventas + ítems + pagos, movimientos de stock y de
cuenta corriente) tal cual está guardado, sin curar — a diferencia del
resto de los exports, esto es un respaldo para archivar, no un reporte
para leer. Pagina con `.range()` en vez de un `select("*")` directo:
PostgREST corta cualquier consulta en 1000 filas (`max_rows` de
`config.toml`) aunque no se pida un `.limit()`, así que sin eso el
catálogo real del cliente (~2991 productos) se hubiera truncado a los
primeros 1000 sin ningún error visible. Es manual y bajo demanda, no
un backup automático recurrente — `perfiles` (cuentas de operador, no
datos del negocio) queda afuera a propósito. **De un solo sentido a
propósito**: no hay pantalla para volver a cargar ese `.xlsx` — restaurar
12 tablas con relaciones por `id` (respetando orden de dependencias,
qué hacer si un id ya existe, etc.) es mucho más riesgoso que
exportarlas, y no fue lo que se pidió (decidido con Enzo, 2026-08-14).
Es un archivo para tener guardado por las dudas, no una función de
"deshacer". Si alguna vez hace falta restaurar de verdad, es trabajo
puntual para hacer con cuidado en el momento — o, para un desastre real
de la base, los backups del lado de Supabase (Point-in-Time Recovery,
plan pago), no este archivo.

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
reservado para esto desde el día 1.

## Supuestos tomados (a confirmar con el cliente)

- Un solo local, un solo turno de trabajo por vez; los dos usuarios
  (los dueños) comparten el mismo rol, sin permisos diferenciados
  todavía — `config/cliente.ts` y la RLS ya están preparados para sumar
  un rol `operador` más adelante sin reescribir nada (queda para M8).
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
- Complementos de impresión térmica y facturación quedan para una
  segunda etapa; el complemento de pantalla al cliente sí entra en esta
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
