# Plan — Rol de empleado + Auditoría (M9 Multiusuario)

Documento de trabajo para seguir el progreso mientras se construye. Se
borra (y su contenido pasa a `README.md` → "Estado actual") cuando esté
todo terminado, mismo criterio que `PENDIENTES.md`.

Origen: pedido explícito del dueño (vía Enzo, 2026-08-18) — quiere poder
dar de alta un empleado con menos visibilidad que él, y una pantalla de
auditoría para revisar qué hizo cada usuario. Motivador concreto: un
empleado deshonesto podría restar stock con un motivo falso, o aplicar
un recargo a un cliente con deuda sin que corresponda.

## Decisiones ya tomadas (no volver a preguntar)

- **Costo/margen**: `precio_costo` no lo ve el operador en ningún lado
  (Stock, calculadora, Excel). `/reportes` queda 100% oculto para operador.
- **Catálogo**: operador no crea/edita/elimina productos, rubros ni
  proveedores, ni importa/exporta Excel de Stock. Sí puede "Ajustar
  stock"/"Carga rápida" (entrada y salida) y armar/imprimir etiquetas.
- **Precio de venta**: no se toca desde "Ajustar stock" si el usuario es
  operador (hoy el campo "Precio de venta" aparece en toda "Entrada").
- **Motivo de salida de stock**: pasa a ser obligatorio, para los dos
  roles (hoy es opcional y cae a un genérico si se deja vacío).
- **Recargo por atraso en cuenta corriente**: solo dueño. Operador puede
  cobrar pagos (efectivo/transferencia) y dar de alta clientes rápido,
  pero no aplicar/modificar recargo. Exportar cuenta corriente: dueño-only.
- **Anulación de venta**: la puede seguir haciendo el operador igual que
  hoy (ya exige motivo y ya guarda quién fue) — no se construye ningún
  flujo de autorización/PIN del dueño. El control es auditar, no bloquear.
- **Historial de cierres de caja**: operador ve el turno abierto actual
  (ya filtrado por usuario hoy) y **sus propios** cierres pasados —
  nunca los de otro usuario. Exportar reporte de caja: dueño-only.
- **Proveedores**: operador con solo lectura + "Productos y pedido".
- **Notas**: sin cambios, acceso completo para los dos roles.
- **Usuarios** (alta/gestión de operadores): pantalla nueva, dueño-only.
- **Auditoría**: pantalla nueva, dueño-only.
- **Cerrar sesión**: no existe hoy en toda la app, se agrega sí o sí.

**Supuesto sin confirmar explícitamente** (si está mal, avisar): Notas y
"Pantalla al cliente" quedan accesibles para operador tal cual están hoy,
no se restringen (no fueron mencionadas como sensibles).

## Fase 0 — Base para poder auditar ✅ (2026-08-18)

- [x] Migración: agregar `movimientos_caja.usuario_id uuid references
      perfiles(id)` (hoy no existe — sin esto nunca se puede saber quién
      hizo un retiro/ingreso manual).
- [x] Completar `usuario_id` en los 4 lugares que insertan en
      `movimientos_caja`: `registrar_venta()`, `anular_venta()`,
      `registrar_movimiento_cuenta_corriente()`, y el insert directo de
      `FormularioMovimientoCaja.tsx` (recibe `usuarioId` como prop desde
      `caja/page.tsx`, que ya lo tiene vía `turno.usuarioId`).
- [x] `registrar_ajuste_stock()`: exigir `p_motivo` no vacío cuando
      `p_tipo = 'salida'` — más validación espejo en el front
      (`FormularioAjusteStock.tsx`, `FormularioCargaRapida.tsx`).
- [x] `anular_venta()`: exigir `p_motivo` no vacío (el front ya lo
      pedía, ahora también es la barrera real en la función).

Migración: `20260818110000_auditoria_usuario_caja_y_motivos_obligatorios.sql`,
ya aplicada a la base hosteada. De paso quedó otra migración chica,
`20260818100000_fix_registrar_venta_columna_ambigua.sql` — bug real
encontrado al cobrar (no estaba en el plan original, ver el commit/README).

## Fase 1 — RLS por rol (la barrera real, no solo UI) ✅ (2026-08-18)

- [x] Vista `productos_visibles` (`security_invoker=true`, no bypasea la
      RLS de `productos`): `precio_costo` viaja `null` si
      `auth_rol() <> 'dueño'`. `listarProductos()` pasa a leer de acá
      (protege de paso "Editar" y "Exportar Excel", que reusan el mismo
      array — `Producto.precioCosto` ahora es `number | null`).
- [x] `productos`/`categorias`/`proveedores`: policy de escritura
      (`insert`/`update`/`delete`) restringida a `auth_rol() = 'dueño'`;
      lectura sigue abierta a cualquier perfil activo.
- [x] `importar_catalogo()`: agregado chequeo `auth_rol() = 'dueño'`.
- [x] `registrar_ajuste_stock()`: si `auth_rol() <> 'dueño'`, ignora
      `p_precio_venta_nuevo` (lo fuerza a `null`) en vez de aplicarlo.
- [x] `registrar_movimiento_cuenta_corriente()`: si `p_tipo = 'recargo'`
      exige `auth_rol() = 'dueño'`.
- [x] `turnos_caja`: policy de `select` — dueño ve todo, operador solo
      `usuario_id = auth.uid()` (cubre "actual + propios pasados" sin
      tocar `listarTurnosCerrados()`).
- [x] `movimientos_caja`: mismo criterio de `select` que `turnos_caja`,
      pero con su propia policy (protegiendo `turnos_caja` no alcanza,
      es otra tabla) usando la columna `usuario_id` de la Fase 0. De
      paso, el `insert` directo de `FormularioMovimientoCaja.tsx` ahora
      exige `usuario_id = auth.uid()` — un operador ya no puede grabar
      un movimiento de caja a nombre de otro usuario (no estaba pedido
      explícitamente, pero es el mismo tipo de hueco que motivó todo
      esto). `BotonExportarCaja` dueño-only queda para Fase 5 (UI).
- [x] `perfiles`: nueva policy (sumada, no reemplaza las de Núcleo) para
      que `auth_rol() = 'dueño'` pueda `select`/`update` cualquier fila.
- [x] `rls.test.ts`: casos nuevos en `stock/rls.test.ts` y
      `clientes/rls.test.ts`, más `caja/rls.test.ts` (no existía). 71
      tests, todos verdes.

Migración: `20260818120000_rls_rol_operador.sql`, ya aplicada. Al armar
los tests encontré y corregí un test **preexistente** roto (no
relacionado a este plan): "una salida no puede dejar el stock en
negativo" usaba la clave de servicio como si fuera una sesión de
usuario — `auth.uid()` es `null` para esa clave, así que nunca pasaba
`auth_activo()` y el test estaba mal desde que se escribió, no desde
hoy. Corregido para usar una sesión real.

## Fase 2 — Sesión y navegación por rol ✅ (2026-08-18)

- [x] `(app)/layout.tsx` pasa a Server Component: trae el perfil una vez
      (`obtenerPerfilActual()`, nuevo en `src/lib/supabase/perfil.ts`) y
      lo baja a `BarraLateral`. De paso cubre el caso de un perfil
      desactivado (Fase 3) — redirige a `/ingresar` en vez de mostrar
      pantallas rotas.
- [x] `BarraLateral.tsx` recibe `perfil` y oculta "Reportes" si no es
      dueño (mecanismo genérico `soloDueño` en `ItemNav`, listo para que
      Usuarios/Auditoría lo usen en Fase 3/4 — esas todavía no tienen
      link acá porque la pantalla no existe hasta esa fase).
- [x] Bloque de usuario nuevo al pie de `BarraLateral` (no en
      `BarraSuperior`, que varía por página): nombre + rol
      ("Dueño"/"Empleado") + `BotonCerrarSesion.tsx` (`auth.signOut()` →
      `/ingresar`). Primer logout que existe en toda la app.
- [x] `/reportes` llama a `exigirDueño()` (mismo helper, reusable en
      Usuarios/Auditoría cuando se construyan).

`npm run build` sin errores (14 rutas, todas compilan) y probado que
`/ventas` sin sesión sigue redirigiendo a `/ingresar`. **Sin verificar a
ojo en el navegador**: no tengo forma de manejar un browser real desde
acá. Quedó un server de desarrollo corriendo en `localhost:3000` — si
podés entrar con tu usuario real y confirmar que el pie de la barra
lateral (nombre/rol/Cerrar sesión) se ve bien y que cerrar sesión
funciona, mejor. Cuando termines, avisame o cerralo vos mismo
(`Ctrl+C` en la terminal donde quedó corriendo, o pedime que lo mate).

## Fase 3 — Pantalla "Usuarios" (dueño-only) ✅ (2026-08-18)

- [x] `src/lib/supabase/admin.ts`: cliente con `service_role`, detrás de
      `server-only` (paquete nuevo, `npm install server-only` — hace
      fallar el build si algún Client Component lo importa por error).
- [x] Alta de operador (`FormularioNuevoOperador.tsx`): nombre, email,
      contraseña inicial. **Primeras Server Actions del proyecto**
      (`src/modulos/usuarios/consultas/acciones.ts`, `crearOperador` /
      `restablecerContraseña`) — todo lo demás se resolvía con RLS o
      funciones `security definer`, pero alta de usuario y reset de
      contraseña son operaciones de `auth.admin`, no existen como
      función SQL. Cada Server Action repite su propio chequeo de "sos
      dueño" (`exigirSesionDeDueño()`, en `consultas/autorizacion.ts`,
      función aparte y testeable — a diferencia de todo lo demás en
      este proyecto, acá no hay una RLS de respaldo si este chequeo
      tuviera un agujero: `auth.admin` bypasea todo).
- [x] Activar/desactivar (`PanelUsuarios.tsx`): update directo a
      `perfiles.activo`, no una Server Action — es una sola columna sin
      `auth.admin` de por medio, la RLS de Fase 1 ya alcanza. No se
      puede activar/desactivar ni resetear la propia cuenta desde acá
      (fila "(vos)" sin acciones, para no poder auto-bloquearse).
- [x] Restablecer contraseña (`BotonRestablecerContraseña.tsx`).
- [x] Listado (`PanelUsuarios.tsx`): nombre, correo (vive en
      `auth.users`, se trae con `admin.auth.admin.listUsers()`, no hay
      forma de leerlo por la API de datos normal), rol, estado.
- [x] Nav: "Usuarios" en `BarraLateral.tsx` (grupo Administración,
      `soloDueño`). `config/cliente.ts`: `usuariosGranular: true`.

Tests: `usuarios/consultas/autorizacion.test.ts` (con sesión real de
operador rechaza, con sesión real de dueño no, sin sesión rechaza) — es
la pieza más sensible de esta fase por no tener respaldo de RLS.
`npm run build` sin errores (15 rutas). **Sin probar a mano el flujo de
punta a punta en el navegador** (crear un empleado real desde el botón,
ver que aparezca en la tabla, activar/desactivar, resetear contraseña)
— seguí sin poder manejar un navegador desde acá. Esta fase además
es la primera oportunidad real de confirmar lo que quedó pendiente de
la Fase 2: creando un empleado de prueba y entrando con esa cuenta en
otra ventana/incógnito deberías ver la barra lateral recortada (sin
Reportes ni Usuarios) — vale la pena chequear los dos juntos.

## Fase 4 — Pantalla "Auditoría" (dueño-only) ✅ (2026-08-18)

- [x] Vista `auditoria_movimientos` (SQL, `security_invoker` +
      **su propio `where auth_rol() = 'dueño'`** — ninguna de las 5
      tablas de abajo tiene una policy dueño-only en `select` hoy,
      sin ese `where` el operador vería todo esto igual a través de la
      vista): une `movimientos_stock` + `movimientos_cuenta_corriente` +
      `movimientos_caja` + `ventas` anuladas + cierres de `turnos_caja`,
      normalizado a `fecha, usuario_id, tipo, descripcion, monto`.
      Turno cerrado con diferencia negativa (faltante) queda como su
      propio "movimiento", con el monto de la diferencia — señal directa
      de patrón sospechoso por usuario, no pedida explícitamente pero
      se desprende del mismo dato que ya se guardaba.
- [x] `PanelAuditoria.tsx`: filtros de fecha (Desde/Hasta, refetch al
      servidor, igual que el selector de día de Reportes), Usuario y
      Tipo (los dos últimos filtran en el cliente sobre lo ya traído).
      Tope de 1000 filas por rango (mismo límite de PostgREST que el
      resto del proyecto) — con volumen real un rango angosto no
      debería acercarse a eso.
- [x] Insignia por tipo: alerta para salida de stock, recargo, retiro de
      caja, venta anulada y devolución por anulación; ok para lo
      rutinario. Cierre de turno es el único caso dinámico: alerta si la
      diferencia es negativa, ok si no.

Migración `20260818130000_auditoria_vista.sql`, ya aplicada. Sumé
`formatearFechaHora()` en `src/lib/formato.ts` (mismo mecanismo de
`formatearHora()` para el bug de hidratación ya conocido, pero con
fecha además de hora — esta tabla cruza varios días, no solo "hoy").

Test: `auditoria/rls.test.ts` — un operador hace un ajuste de stock real
(vía la función, no un insert directo) y se confirma que el propio
operador no ve nada en la vista, el dueño sí lo ve con el motivo real, y
sin sesión no se puede leer nada.

`npm run build` sin errores (16 rutas). **Sin probar a mano en el
navegador** (mismo límite de siempre — no puedo manejar un navegador
desde acá). El server de desarrollo sigue corriendo en `localhost:3000`.

**Agregado post-Fase 4** (pedido explícito de Enzo, 2026-08-18):
`BotonExportarAuditoria.tsx` — exporta exactamente lo que está filtrado
en pantalla (Usuario/Tipo, no todo el rango de fechas), con
`filaSegura()` porque `descripcion` lleva texto libre de usuario
(motivo, nota) — mismo hueco de CSV/Formula Injection que ya se había
resuelto en el backup, no en este export nuevo, así que se aplicó desde
el día 1 acá. Además, `BotonDescargarBackup.tsx` suma dos hojas:
`auditoria_movimientos` (entra en el loop genérico, es una vista, se
comporta como cualquier tabla) y `perfiles` (aparte, con columnas
explícitas — sin esto `usuario_id` en el resto de las hojas del backup
es un uuid sin nombre; se excluye `token_pantalla`, que sigue siendo
sensible, mismo motivo por el que `perfiles` quedaba afuera antes).

## Fase 5 — Ocultar/gatear lo que ya existe ✅ (2026-08-18)

Antes de tocar botones sueltos: `src/lib/supabase/PerfilContext.tsx`
(nuevo, no estaba en el plan original) — `PerfilProvider`/`usePerfil`/
`useEsDueño`, sembrado una vez en `(app)/layout.tsx`. Sin esto, cada
botón a ocultar (repartidos en Stock/Clientes/Caja/Proveedores, varios
niveles bajo su página) hubiera necesitado que la página los recibiera
por prop y se los pasara a mano — con un Context, cualquier Client
Component pregunta el rol directo. La barrera real sigue siendo la RLS
de Fase 1; esto es solo para no mostrar un botón que va a fallar.

- [x] Stock: `FormularioNuevoProducto`, `FormularioEditarProducto`,
      `BotonEliminarProducto` (+ el toggle "Eliminar productos" del modo
      de selección múltiple), `PanelRubros`, `FormularioImportarExcel`,
      `BotonExportarStock` — dueño-only. Campo "Precio de venta" oculto
      en `FormularioAjusteStock.tsx` (único que lo tiene, confirmado en
      Fase 0). Motivo de salida ya era obligatorio para los dos roles
      desde Fase 0.
- [x] Clientes: "% de recargo" y `BotonExportarCuentaCorriente`
      dueño-only en `PanelCuentaCorriente.tsx`.
- [x] Caja: `HistorialCierres` sin tocar (la policy de Fase 1 ya le
      devuelve al operador solo sus propios turnos cerrados — no hacía
      falta nada más). `BotonExportarCaja` dueño-only.
- [x] Proveedores: `FormularioNuevoProveedor`, `FormularioEditarProveedor`,
      `BotonEliminarProveedor` dueño-only (`PanelPedidoProveedor` sigue
      para los dos roles).

`npm run lint` encontró un error real durante el trabajo (no cosmético):
en `FormularioImportarExcel.tsx` había un `useMemo` más abajo en el
archivo, después de donde puse el `if (!esDueño) return null` — hook
llamado condicionalmente, rompe las Reglas de los Hooks. Corregido
moviendo el `useMemo` arriba de todos los `return` tempranos, mismo
criterio que ya seguían los `useState`.

Build limpio (15 rutas), typecheck/lint/tests (77) verdes. **Sin
probar a mano en el navegador** — mismo límite de siempre.

## Fase 6 — Cierre

- [ ] `npm run lint && npm run typecheck && npm run test`.
- [ ] Probar de punta a punta con una cuenta operador real (no solo
      leyendo código): login, cada restricción de arriba, y que
      Auditoría muestre sus acciones.
- [ ] `config/cliente.ts`: `usuariosGranular: true`, nuevo módulo
      `auditoria: true`.
- [ ] `README.md` → "Estado actual": mover el resumen de todo esto.
- [ ] Borrar este archivo.

## Fuera de alcance (no pedido, no se construye ahora)

- Autorización con PIN de un segundo usuario para anular ventas.
- Alertas automáticas / recordatorios de deuda (eso es otra pieza de la
  cotización de M9, no lo que se pidió en esta vuelta).
- Permisos granulares por acción más allá de dueño/operador (un tercer
  rol, permisos a medida por empleado, etc.).
