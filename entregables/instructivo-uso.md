# Instructivo de uso — Sistema Mini Market Marlyn

Este documento explica cómo usar el sistema en el día a día del local:
qué hace cada pantalla y cómo se resuelven las tareas más comunes. La
idea es que lo tengan a mano las primeras semanas y después casi no
haga falta.

---

## Cómo entrar

La dirección del sistema es
[marlyn-minimarket.vercel.app](https://marlyn-minimarket.vercel.app/) —
conviene guardarla como favorito en la PC del local. Ahí van a ver una
pantalla para poner usuario y contraseña. Una vez adentro, a la
izquierda (o arriba, si lo
abren desde el celular) van a ver el menú con todas las secciones:
**Ventas, Caja, Reportes, Stock, Clientes, Proveedores, Notas,
Usuarios y Auditoría**. Estas dos últimas, y Reportes, solo las ve
quien entra con una cuenta de dueño — un empleado ve un menú más corto
(ver "Usuarios y permisos" más abajo).

Arriba de cada pantalla siempre aparece la fecha del día, para no
tener dudas de en qué jornada están trabajando.

---

## Ventas — la pantalla del mostrador

Es la pantalla principal, la que van a tener abierta todo el día.

**Cargar productos**: se puede escanear el código de barras (el
cursor siempre está listo para leer, no hace falta clickear en
ningún lado antes) o buscar por nombre y tocar el producto en la
grilla.

**Productos por peso o por litro** (fiambres, quesos, bebidas
sueltas, etc.): en vez de sumar de a uno, aparecen dos casilleros para
cargar la cantidad — uno en gramos/mililitros y otro directamente en
pesos ("quiero $2.000 de jamón"). Cambian el uno al otro solos, así
que se puede usar el que sea más cómodo en el momento.

**Atender más de una venta a la vez**: si a un cliente se le olvidó
algo y hay que atender a otro mientras tanto, no hace falta perder lo
que ya se cargó. Arriba del carrito hay pestañas ("Venta 1", "Venta
2"...) — cada una guarda lo suyo, y se puede volver a cualquiera
cuando haga falta. Aunque se reinicie la página por accidente, lo que
estaba cargado no se pierde.

**Cobrar**: al finalizar se elige cómo paga — Efectivo, Transferencia,
QR, Fiado, o una combinación (Mixto, por ejemplo parte efectivo y
parte transferencia). Si el cliente paga en efectivo, el sistema
calcula el vuelto solo.

**Fiado**: si el cliente todavía no está cargado, se puede crear en
el momento con solo el nombre, sin salir de la pantalla de venta. Los
datos completos (teléfono, dirección) se cargan después desde
Clientes. **No hace falta fiar el total**: al lado del cliente hay un
campo opcional "¿Cobrás algo ahora?" con su propio selector de medio
(Efectivo, Transferencia o QR) — lo que se cobra ahí se descuenta, y
solo el resto queda en la cuenta corriente. Si se deja vacío, se fía
todo, como siempre.

**El comprobante**: al confirmar la venta aparece el ticket en
pantalla, con el detalle de lo que se compró, el total y cómo se
pagó. Debajo hay dos íconos:

- **Impresora**: manda a imprimir el ticket directo, ajustado al ancho
  de una impresora térmica de 80mm (si el negocio usa una de 58mm, hay
  que avisar para ajustar ese valor).
- **Flecha hacia abajo (descargar)**: al tocarlo, pregunta si querés
  la imagen (para guardar o mandar por WhatsApp) o el PDF.

Cualquier ticket viejo se puede volver a ver e imprimir/descargar
desde **Reportes** (más abajo).

**Si hay que anular una venta**: solo se puede hacer mientras el
turno de caja sigue abierto (es decir, el mismo día que se hizo, antes
de cerrar caja). En la lista "Ventas de este turno" aparece el botón
"Anular" en cada venta — pide un motivo y, si se había cobrado en
efectivo, descuenta automáticamente esa plata de lo que "debería
haber" en la caja. La venta anulada queda visible en la lista (más
tenue, marcada como "anulada"), no desaparece — es el registro de que
existió y se anuló.

---

## Caja

**Abrir caja**: al empezar el turno se carga el monto con el que se
arranca el cajón. A partir de ahí, cada venta en efectivo y cada pago
de cuenta corriente que se cobre en efectivo se van sumando solos —
no hay que anotar nada a mano.

**Durante el turno** se ve todo el tiempo cuánto "debería haber" en el
cajón en ese momento, y una lista con el detalle de cada movimiento
(ventas, pagos, y cualquier retiro o ingreso manual).

**Registrar un movimiento manual**: para cuando sale o entra plata
que no es una venta (pagarle a un repartidor, poner plata propia,
etc.) — se anota el monto y el motivo, para que quede clara la razón
más adelante.

**Cerrar caja**: al final del turno se cuenta el efectivo real y se
carga ese número. El sistema muestra si sobró, faltó, o cerró justo
comparando contra lo calculado. Se puede exportar un Excel con el
resumen del turno, las ventas y los movimientos.

**Historial de cierres**: debajo, siempre visible, queda una tabla con
los turnos ya cerrados — fecha, horario, apertura, lo que debería
haber, lo contado y la diferencia de cada uno. Sirve para mirar hacia
atrás sin tener que acordarse de memoria cómo cerró cada día.

---

## Stock

**Cargar un producto nuevo**: nombre, rubro, proveedor, código de
barras (opcional), y el precio. Para el precio hay una calculadora:
se carga el costo, el porcentaje de ganancia que se quiere ganar, y
calcula solo el precio de venta (o al revés: si se carga el precio a
mano, calcula qué porcentaje de ganancia queda). Hay un casillero
aparte por si el precio necesita sumar IVA.

**Ajustar stock**: en cada producto, el botón "Ajustar stock" suma o
resta cantidad — se elige "Entrada" (llegó mercadería) o "Salida"
(rotura, vencido, corrección de un conteo) y se carga la cantidad,
siempre en positivo, con un motivo opcional. El sistema no deja hacer
una salida por más de lo que hay cargado. Como con todo lo demás en
Stock, el stock nunca se pisa a mano: cada ajuste queda en el
historial.

**Carga rápida**: para cuando llega un pedido con varios productos a
la vez, el botón "Carga rápida" (al lado de "Etiquetas") evita tener
que buscar cada producto en la tabla uno por uno. Se busca por nombre
o se escanea el código de barras, se carga Entrada o Salida y la
cantidad, "Guardar y buscar el siguiente" lo guarda al toque y deja
todo listo para cargar el producto que sigue sin cerrar la ventana —
recién al tocar "Cerrar" se actualiza la tabla de Stock con todo lo
cargado.

**Rubros**: se pueden crear, renombrar o borrar desde el botón
"Rubros" arriba de la lista.

**Importar desde Excel**: si en algún momento hay que cargar muchos
productos de una — por ejemplo, migrando de otro sistema — se puede
subir un Excel con las columnas de descripción, proveedor, código de
barras, familia (rubro) y costo. El sistema arma los precios de venta
solo, con el margen que se elija en ese momento.

**Exportar a Excel**: baja el catálogo completo (código, producto,
rubro, proveedor, costo, precio, stock).

**Eliminar un producto**: si nunca se vendió, se borra directamente.
Si ya tiene ventas en su historial, en vez de borrarlo el sistema lo
"desactiva" — deja de aparecer en Stock y no se puede volver a
vender, pero las ventas viejas que lo tenían cargado no se rompen (se
sigue viendo con la marca "[Eliminado]" en los reportes viejos, para
no perder ese historial).

---

## Clientes (cuenta corriente / fiado)

Ficha con nombre, teléfono y dirección. Desde "Ver cuenta" se ve el
historial completo de fiados y pagos de ese cliente — cada fiado
muestra qué productos incluyó esa venta.

**Cobrar un pago**: se elige el medio (efectivo o transferencia). Si
es efectivo, además de saldar la cuenta, ese dinero se suma
automáticamente a la caja del turno abierto.

**Recargo por atraso**: si corresponde cobrar un recargo por demora en
el pago, hay un campo para cargar el porcentaje a mano — el sistema
calcula el monto, pero el criterio de cuánto cobrar (a la semana, al
mes, etc.) lo decide quien está cobrando, no es una regla automática.

Desde "Ver cuenta" también se puede exportar un Excel con el resumen
y el historial de movimientos de ese cliente puntual.

---

## Proveedores

Ficha con nombre, contacto y teléfono. Desde "Productos y pedido" se
ve la lista de productos de ese proveedor (la misma que aparece en
Stock), se eligen los que hacen falta reponer con la cantidad, y el
sistema arma el texto del pedido listo para copiar y mandar por
WhatsApp o donde corresponda.

---

## Notas

Un espacio simple para anotar lo que haga falta: pegar el texto de un
pedido que ya se le mandó a un proveedor (para tener el registro de
qué se pidió y cuándo), un recordatorio, o cualquier otra cosa. Se
escribe o se pega el texto arriba, se guarda, y queda en una lista con
la fecha. Se puede borrar cuando ya no sirva.

---

## Reportes

El panel del día: cuánto se vendió, ticket promedio, cuántas
transacciones, el balance (ganancia bruta), un gráfico de ventas por
hora, cómo se repartieron los medios de pago, los productos más
vendidos, y una alerta de los productos con poco stock. Se puede
elegir cualquier día con el selector de fecha, no solo el de hoy.

**Detalle de ventas**: la lista de cada venta del día, con un ícono
de ticket para volver a ver (e imprimir o descargar) el comprobante de
esa venta puntual.

**Exportar a Excel**: baja un archivo con todo el detalle del día
elegido.

**Backup completo**: además del export del día, hay un botón para
bajar una copia completa de todos los datos del sistema (productos,
clientes, ventas, etc.) en un Excel — pensado para guardarlo de vez en
cuando por las dudas, no para usar todos los días. Ese archivo es solo
para guardar: no hay forma de "cargarlo de vuelta" al sistema, así que
no reemplaza el cuidado normal de la información, es un respaldo
extra.

---

## Usuarios y permisos

Además de la cuenta del dueño, se pueden crear cuentas para empleados,
con menos acceso — pensado para el mostrador, sin exponer información
que no hace falta que un empleado vea.

**Qué ve un empleado, a diferencia del dueño**: no ve el precio de
costo de los productos ni el margen de ganancia (en Stock ve el precio
de venta nada más), no tiene acceso a Reportes ni a esta pantalla de
Usuarios ni a Auditoría, no puede dar de alta, editar ni borrar
productos, rubros o proveedores (sí puede "Ajustar stock" y "Carga
rápida" — sumar o restar cantidad, con motivo — pero sin tocar el
precio de venta desde ahí), no puede aplicar un recargo por atraso a un
cliente, y no puede exportar el catálogo, la cuenta corriente ni los
reportes de caja. El resto del día a día funciona igual que para el
dueño: vender, cobrar, abrir y cerrar su propio turno de caja, cargar
clientes, anular una venta de su turno, y usar Proveedores para
consultar y armar pedidos.

**Crear una cuenta de empleado**: desde "Usuarios" (solo visible para
el dueño, en el menú) — se carga el nombre, un correo y una contraseña
inicial, que se le pasa al empleado directamente (el sistema no manda
ningún mail). El empleado entra con ese correo y contraseña desde la
misma pantalla de siempre.

**Si un empleado deja de trabajar en el local**: no hace falta borrar
la cuenta, alcanza con "Desactivar" desde la misma pantalla — deja de
poder entrar al sistema al toque, y se puede volver a activar más
adelante si hiciera falta.

**Si un empleado olvida su contraseña**: el dueño se la puede resetear
desde la misma pantalla ("Restablecer contraseña") y pasarle la nueva.

---

## Auditoría

Un registro de quién hizo qué, visible solo para el dueño — para poder
revisar después cualquier movimiento llamativo: un ajuste de stock, un
recargo aplicado, un retiro de caja, una venta anulada, o un cierre de
turno que no cerró justo.

Cada fila muestra la fecha, quién lo hizo, de qué tipo es (en rojo los
que conviene mirar más de cerca: salidas de stock, recargos, retiros de
caja, ventas anuladas, cierres con faltante), el detalle (por ejemplo
qué producto y qué motivo se escribió) y el monto. Se puede filtrar por
rango de fechas, por usuario o por tipo de movimiento, y exportar a
Excel exactamente lo que se esté mirando en ese momento.

---

## Pantalla al cliente

Si el mostrador tiene una segunda pantalla (TV o tablet mirando al
cliente), desde "Pantalla al cliente" se consigue un link para
emparejarla — se configura una sola vez y después queda funcionando
solo. Mientras se carga una venta, esa pantalla va mostrando en vivo
los productos y el total, para que el cliente vaya viendo lo mismo que
el vendedor.

---

## Algunas cosas para tener en cuenta

- **El sistema necesita internet** para funcionar — no guarda ventas
  si se corta la conexión.
- **El ticket no es una factura.** Es un comprobante interno del
  negocio, aclarado en el propio ticket ("Documento no válido como
  factura").
- **Sin stock cargado, no se puede vender** un producto — es una
  decisión a propósito, para que el stock del sistema siempre refleje
  la realidad.
- Hay dos niveles de acceso: dueño y empleado. Ver "Usuarios y
  permisos" más arriba para el detalle de qué diferencia a uno del
  otro.

Ante cualquier duda de uso, o si algo no se comporta como esperan,
avisen y lo vemos juntos.
