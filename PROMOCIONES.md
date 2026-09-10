# Módulo de promociones

Construido el 2026-09-10, a pedido de Jason (audio, transcripción
completa en el commit de la migración). Idea original, en sus palabras:

> "Yo cargo caramelo Alka a 40 pesos, pero lo vendo 3 por 100 pesos. […]
> Tengo la Coca de 2 y medio, el Fernet de 700 y tanto — una oferta así,
> ¿no? […] Que me salga la opción cuando se hace la venta, que le diga
> al cliente que hay una oferta, y que afecte el stock también."

Este documento explica qué se construyó, cómo se usa y por qué se
tomaron ciertas decisiones de diseño — para Enzo (o quien retome este
código más adelante), no para Jason. El plan original de discusión
(antes de escribir código) quedó en `PLAN-PROMOCIONES.md`, que no viaja
al repo (gitignored): este archivo es la versión final, sí versionada.

## Los dos tipos de promoción

**Descuento por cantidad** (`tipo: 'cantidad'`): un solo producto, con
un umbral de unidades y un precio de paquete. Ejemplo: "3 Alka x $100"
— llevando 3 o más, cada grupo de 3 sale $100 en vez de 3×$40=$120. Si
el carrito tiene una cantidad que no es múltiplo exacto (5 Alka), el
sobrante se cobra a precio normal (1 paquete de 3 a $100 + 2 sueltas a
$40 = $180).

**Combo de productos distintos** (`tipo: 'combo'`): dos o más productos
puntuales a un precio conjunto fijo, sea cual sea el precio individual
de cada uno. Ejemplo: "Fernet + Coca" a $19.000, sin importar que el
Fernet solo cueste $18.000 y la Coca $2.500 (o lo que sea que valgan
ese día). Si el carrito tiene para armar el combo más de una vez (2
Fernet + 2 Coca), arma dos combos.

## Cómo lo usa Jason

`/promociones` (ítem "Promociones" en el menú lateral, visible a
cualquier perfil activo desde el 2026-09-11 — antes era dueño-only).
Crear/editar/pausar/borrar sigue siendo solo del dueño: `PanelPromociones.tsx`
oculta esos botones para un colaborador (`useEsDueño()`), y la RLS de
`promociones`/`promociones_items` los bloquea del lado de la base pase
lo que pase en la pantalla — un colaborador solo puede mirar el listado.

- **Listado**: nombre, qué productos/cantidades incluye, precio de la
  promo, estado (activa/pausada), y un aviso "necesita revisión" si
  alguno de sus productos fue eliminado de `/stock` (ver más abajo).
  Botones (solo dueño): Editar, Pausar/Reactivar, Eliminar.
- **Alta**: elegir tipo (esto ya no se puede cambiar después de creada
  — cambia el significado de "cantidad" en cada ítem), buscar y
  agregar producto(s) con su cantidad, cargar el precio de la promo.
  Muestra una vista previa en vivo ("Normal: $120 → Promo: $100,
  Ahorro: $20") antes de guardar.
- **Edición**: se puede tocar todo salvo el tipo — productos,
  cantidades, precio, nombre.

No hay confirmación al eliminar (mismo criterio que el resto del
sistema — Rubros, Proveedores): borrar es inmediato.

## Cómo se aplica en la venta

Automático, sin que el cajero tenga que hacer nada: al armar el
carrito en `/ventas`, si el contenido encaja con una promo activa, esa
línea muestra el precio normal tachado, el precio con promo, y una
etiqueta con el nombre de la promo y el ahorro. El resumen del carrito
suma un total de "Ahorrás $X con esta compra" si hay alguna promo
aplicada. La pantalla del cliente (`/pantalla-cliente`, vía Realtime)
muestra exactamente lo mismo — mismo dato, sin lógica duplicada.

El stock se descuenta igual que siempre (por `cantidad`, no por
precio) — la promo nunca lo toca aparte.

## Modelo de datos

```
promociones          id, nombre, tipo ('cantidad'|'combo'), precio_promocional, activa
promociones_items    id, promocion_id, producto_id, cantidad
```

- `cantidad`: exactamente 1 fila en `promociones_items` (el producto +
  el umbral).
- `combo`: 2 o más filas, una por producto distinto, con la cantidad
  que pide de cada uno (normalmente 1, pero podría ser 2).

Dos funciones RPC (`security definer`, dueño-only, en
`supabase/migrations/20260910110000_promociones.sql`):

- **`guardar_promocion(p_id, p_nombre, p_tipo, p_precio_promocional, p_activa, p_items)`**
  — alta y edición en un solo llamado (`p_id null` = alta). Reemplaza
  la lista completa de items (mismo criterio que
  `guardar_codigos_barras_adicionales` de Stock: el formulario manda
  todo, no sabe qué cambió). Valida: tipo válido, nombre no vacío,
  precio > 0, sin productos repetidos dentro de la misma promo,
  cantidad de productos según el tipo (1 para cantidad, 2+ para
  combo), y que ningún producto quede con dos promos "cantidad"
  activas a la vez (ambigüedad de cuál paquete aplica en la venta).
- **`activar_promocion(p_id, p_activa)`** — pausar/reactivar sin
  reenviar los items. Existe aparte de un `update` directo a la tabla
  para que reactivar una promo *también* pase por el mismo chequeo de
  "sin solape" — si se hiciera con un `.update()` del cliente, se
  podría reactivar una promo que choca con otra sin que nada lo
  frenara.

RLS: cualquier perfil activo puede **leer** (lo necesita el operador
para que las promos se apliquen solas en `/ventas`); crear/editar/
pausar/borrar es dueño-only — mismo reparto que
`productos_codigos_barras`.

## El algoritmo de aplicación (`aplicarPromociones`)

`src/modulos/promociones/consultas/aplicarPromociones.ts` — función
pura (sin Supabase, sin navegador), testeada en
`aplicarPromociones.test.ts` (11 casos). Recibe el carrito
(`ItemCarrito[]`) y las promos activas, devuelve una copia del carrito
con `subtotal`/`promoAplicada` puestos en las líneas afectadas.

Reglas, en orden:

1. **Una línea con `subtotal` ya tipeado a mano** (venta por peso a
   monto exacto — jamón, queso) nunca se toca. Las promos apuntan a
   productos por unidad (Alka, Fernet, Coca), no a productos que se
   venden por kg/L; en vez de intentar distinguir por tipo de unidad,
   la regla es más simple y más segura: si ya hay un monto explícito
   cargado, se respeta tal cual esté.
2. **Los combos se resuelven antes que los descuentos por cantidad.**
   Son más específicos (piden productos puntuales juntos) y consumen
   del mismo pool de unidades disponibles que después miran los
   descuentos por cantidad — si un producto participa en un combo y
   también tiene su propia promo por cantidad, el combo se lleva su
   parte primero y la de cantidad mira lo que sobra.
3. **El precio de un combo se reparte entre sus líneas, proporcional
   al precio normal de cada una.** No hay forma de insertar una línea
   de "descuento" suelta (`ventas_items.producto_id` no admite null),
   así que el monto de $19.000 de "Fernet + Coca" se divide entre las
   dos líneas según cuánto pesa cada una en el precio normal conjunto.
   **Efecto secundario a tener presente**: en Reportes ("ganancia por
   producto"), esto hace que la ganancia de un combo quede repartida
   de forma un poco artificial entre sus productos, en vez de exacta
   por SKU. Para un solo local sin necesidad de contabilidad fina por
   producto, es un compromiso razonable — si en algún momento hace
   falta precisión ahí, habría que sumar una tabla de detalle de
   promos aplicadas por venta.
4. **El reparto redondea a peso entero, no a centavos** (pedido de
   Jason, 2026-09-11: el reparto proporcional cae naturalmente en
   centavos — $16.682,93 — y en un minimarket donde todo se maneja en
   pesos redondos eso se ve raro). Para que la suma de las líneas siga
   cerrando exacto contra `precio_promocional × veces` sin importar
   cómo caiga el redondeo, el *último* ítem del combo no redondea su
   propia proporción: se lleva lo que sobra del total exacto una vez
   redondeados los demás. `redondearAPeso()` en `aplicarPromociones.ts`
   — a propósito distinto de `calcularSubtotalItem()` (que redondea a
   centavos, como el resto de `/ventas`), porque acá el redondeo es
   sobre el precio ya fijo de la promo, no sobre un cálculo cantidad ×
   precio unitario.

## El aviso ("nube") al escanear, aunque la promo no esté completa

Pedido de Jason (audio, 2026-09-11): *"escaneo el Fernet... que me
salga una nube diciendo que hay una promo, llevando esto o llevando lo
otro"* — quiere que el cajero se entere de la promo apenas escanea uno
de los productos involucrados, para poder ofrecerle al cliente lo que
le falta, no solo cuando la promo ya se disparó.

En `PanelVentas.tsx`, cada vez que `agregarProducto()` agrega o suma
una unidad, se busca con `promocionesDeProducto()`
(`descripcionPromocion.ts`) si ese producto participa de alguna promo
activa — **sin filtrar si ya se completó o no** — y se muestra un
cartel breve ("🏷️ Fernet + Coca a $19.000") arriba del buscador,
autodescartable a los 6 segundos o con la ✕. Es deliberadamente
distinto del aviso de "ya se aplicó" en la línea del carrito
(`FilaCarritoItem`): este es una sugerencia para el cajero, no aparece
en la pantalla del cliente (`PantallaEnVivo`) — mostrarle a un cliente
una promo que todavía no ganó podría confundir más que ayudar.

## "Necesita revisión": un producto eliminado de una promo

Si Jason borra o desactiva (`activo = false`) un producto que está en
una promo activa, esa promo **nunca más se va a poder disparar** — un
producto inactivo no puede entrar al carrito de `/ventas` (ya filtrado
hoy, sin relación con este módulo). En vez de desactivar la promo sola
por trigger (un cambio de estado silencioso, difícil de explicar
después), `listarPromociones()` calcula `necesitaRevision` al leer: si
algún producto de la promo está inactivo, se muestra igual en el
listado con un aviso — Jason ve qué pasó y decide (editarla con otro
producto, o borrarla) en vez de que la promo desaparezca sin
explicación. `paraAplicarEnVenta()` filtra estas promos antes de que
lleguen a `/ventas`, así que el hecho de que sigan "activas" en la base
no importa en la práctica.

## Testing

- `aplicarPromociones.test.ts` (11 casos): umbral no alcanzado, múltiplo
  exacto, sobrante a precio normal, promo pausada, línea con subtotal
  manual (no se toca), combo simple, combo repetido (2 veces), combo +
  sobrante de un producto, combo faltando un producto (no dispara),
  combo + cantidad sobre el mismo producto (orden de aplicación) — con
  los montos ya en peso entero, no en centavos.
- `promociones.test.ts` (4 casos): `paraAplicarEnVenta` filtra pausadas
  y "necesita revisión", no manda datos de más al carrito.
- `descripcionPromocion.test.ts` (6 casos): la frase del aviso para
  cantidad y combo (con nombres de producto reales), y qué promos
  encuentra `promocionesDeProducto()` para un producto dado.
- `rls.test.ts`: contra el Supabase hosteado real (no corre en CI, ver
  README). Cubre: sin sesión no lee ni escribe, el operador lee pero no
  escribe, las validaciones de `guardar_promocion` (tipo/cantidad de
  productos, solape de promos "cantidad" activas), y que
  `activar_promocion` respeta el mismo chequeo de solape que el alta.

## Ideas para más adelante (no construidas)

- Fechas de vigencia (ej. "solo findes") — hoy es un toggle manual
  activa/pausada. Barato de sumar si hace falta.
- `promocion_id` en `ventas_items` + una sección en `/reportes` para
  ver cuánto se usó cada promo y cuánto se descontó en total — así
  Jason podría evaluar si una promo le conviene. Quedó fuera de esta
  entrega por alcance, no por dificultad.
