# Mini Market Merlyn — sistema de gestión

Sistema de gestión comercial a medida para Mini Market Merlyn (minimarket
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
Excel. Detalle de las cinco más abajo. Lo único que falta de Caja son
los movimientos manuales (retiros/ingresos fuera de una venta) — eso
queda para un próximo cambio, igual que la pantalla al cliente en vivo
(sigue con su propio "PENDIENTE" en `src/app/pantalla/[token]/page.tsx`).

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
abre alta/renombre/borrado de rubros, con el borrado bloqueado si hay
productos usando ese rubro. "Proveedores" es lo mismo, sobre la tabla
`proveedores` (nueva) — ambos paneles son instancias de
`PanelListaSimple` (`src/componentes/`), el mismo componente genérico.
Decisión tomada con el cliente sobre `BACKUP.xlsx` (ver más abajo):
"Familia" del Excel es conceptualmente lo mismo que "Rubro" acá, no una
tabla aparte; "Género" no se suma.

**Caja, con arqueo al cierre**: `/caja` abre un turno (monto de
apertura, insert directo — el índice único parcial de `turnos_caja` ya
impide dos turnos abiertos a la vez, no hace falta una función) y
ahora también lo cierra. Para poder arquear, `registrar_venta()` inserta
en `movimientos_caja` la parte en efectivo de cada pago (monto menos
vuelto) al confirmar una venta — antes no lo hacía y no había forma de
saber cuánto efectivo debía haber en el cajón. Con turno abierto,
`/caja` muestra "Ventas de este turno" (mismo listado que `/ventas`,
ver más abajo) y el botón "Cerrar caja"
(`FormularioCerrarCaja.tsx`): un modal con el monto calculado
(apertura + neto de `movimientos_caja`) y un campo editable para el
efectivo contado, precargado con el calculado; al confirmar hace un
`update` directo sobre `turnos_caja` (estado, `monto_cierre_declarado`,
`monto_cierre_calculado`, `cerrado_en`) y muestra si sobró, faltó, o
cerró justo. Movimientos manuales de caja (retiros/ingresos fuera de
una venta) quedan afuera de este cambio.

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
**Seguimiento de ventas del turno**: las ventas confirmadas no se veían
en ningún lado después de cerrar el comprobante — `listarVentasDelTurno`
(`src/modulos/ventas/consultas/ventas.ts`) trae las ventas del turno
abierto con su medio de pago (o "Fiado — nombre del cliente") y
`ListaVentasDelTurno.tsx` las lista (número, hora, medio, total) tanto
en `/ventas` como en `/caja`, para tener el detalle a mano al arquear.
Es de solo lectura por ahora, no incluye anular venta desde acá.

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

**Supuesto de "Balance"**: es margen bruto (ventas − costo de
mercadería vendida), calculado con el `precio_costo` ACTUAL de cada
producto — no se guarda un histórico de costo por venta, así que si el
costo de un producto cambió después de venderlo hoy, el balance de hoy
ya refleja el costo nuevo, no el que tenía al momento de la venta.

**Supuesto sin confirmar con el cliente**: el checkbox "Incluye IVA" de
la calculadora arranca tildado y usa 21% (`config/cliente.ts`,
`reglasNegocio.ivaPorcentaje`) — no está confirmado si Mini Market
Merlyn factura como responsable inscripto o si ese 21% aplica igual a
todo su catálogo (ej. alimentos de la canasta básica suelen tener otra
alícuota). Es una ayuda para cargar precios más rápido, no afecta el
ticket (que sigue sin discriminar IVA).

**Las migraciones SQL ya se corrieron contra una base real** (Supabase
local vía Docker, `supabase db reset`): las 5 migraciones de Núcleo + M1
Stock + M2 Clientes + M5 Caja + M3 Ventas aplican sin errores, las 11
tablas quedan creadas con RLS habilitado, y las funciones
`registrar_venta`/`anular_venta` existen con la firma esperada. Falta
todavía probarlas con datos reales (una venta de punta a punta) una vez
que existan las pantallas.

`/pantalla/[token]` (complemento "pantalla al cliente") es por ahora una
vista estática de espera: falta el emparejamiento por token y la
suscripción a Supabase Realtime que lo conecta con la venta en curso.

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
- `codigo_barras` es `unique` en `productos` (sección siguiente):
  ¿bloqueamos la importación de una fila sin código real, o el import
  simplemente la deja sin código (`null`)? Ver el detalle abajo.
- `Familia` (511 valores distintos en `BACKUP.xlsx`, con duplicados por
  mayúscula/minúscula tipo `"Varios"`/`"VARIOS"`) se decidió mapear
  directo a `rubro` en vez de sumar una tabla nueva — falta confirmar
  con el cliente si esos ~511 valores se importan tal cual (quedarían
  ~511 rubros) o se agrupan/normalizan antes.

## Excel: import de catálogo (pendiente) y export de reportes (construido)

Pedido del cliente, con `BACKUP.xlsx` (raíz del repo, no versionado) como
dato real de referencia: un export de ~2991 productos de su sistema
anterior. Columnas: `Descripcion`, `Proveedor`, `Codigo de barra`,
`Familia`, `Costo`, `Codigo` (interno, correlativo del sistema viejo).
Alcance pedido: import de catálogo (altas masivas a `productos`) y
export de reportes — con ExcelJS (mencionado como stack en
`guia-openspec-gestion-comercial.md`, sección 4). **El export ya está
construido**: el botón "Exportar a Excel" de `/reportes` (ver más
arriba) usa `exceljs` para armar un `.xlsx` de 3 hojas (resumen, medios
de pago, top productos) del día elegido. El import de catálogo en sí
sigue sin implementar; lo que sí ya se resolvió, de cara a ese import
futuro:

- **`Proveedor` ya tiene tabla propia** (`proveedores`, igual de simple
  que `categorias`) y su panel de administración/select en los
  formularios de producto.
- **`Familia` se decidió tratar como sinónimo de `Rubro`**, no como una
  clasificación aparte (ver "Preguntas todavía abiertas" arriba para lo
  que falta confirmar sobre eso). No se agregó "Género".

Sigue pendiente para cuando se construya el import en sí:

- **El 43% de las filas (1290 de 2991) repite código de barras**, pero
  caso por caso: la inmensa mayoría son placeholders del sistema
  anterior (`"0"` sola en 1048 filas, más `"11111111"`, `"4444444444"`,
  etc.), no colisiones reales — son productos pesados/sueltos o
  cargados sin escanear. La migración de Stock ya tiene
  `codigo_barras` como `unique`, lo cual es correcto para códigos
  reales pero **rechazaría de plano un import directo de este archivo**
  tal cual. El import va a necesitar tratar esos placeholders como "sin
  código" (`null`, que sí admite múltiples filas bajo `unique`) en vez
  de copiarlos literalmente. Hay 6 filas más sin `Familia` cargada.
