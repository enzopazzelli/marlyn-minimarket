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

## Fase 3 — Pantalla "Usuarios" (dueño-only)

- [ ] `src/lib/supabase/admin.ts`: cliente con `service_role`, solo se
      importa desde Server Actions/route handlers, nunca desde el navegador.
- [ ] Alta de operador: nombre, email, contraseña inicial
      (`admin.createUser`, con `rol = 'operador'` en `perfiles` después
      del alta — el trigger de `gestionar_usuario_nuevo()` crea la fila
      con `rol = 'dueño'` por defecto, hay que pisarlo).
- [ ] Activar/desactivar (`perfiles.activo`) — ya alcanza para bloquear
      todo el acceso, no hace falta nada nuevo en RLS para esto.
- [ ] Restablecer contraseña (`admin.updateUserById`), útil sin tener
      que mandar mail (no hay infraestructura de email en el proyecto).
- [ ] Listado de usuarios existentes con su rol/estado.

## Fase 4 — Pantalla "Auditoría" (dueño-only)

- [ ] `src/modulos/auditoria/`: consulta que junta `movimientos_stock` +
      `movimientos_cuenta_corriente` + `movimientos_caja` + anulaciones
      de `ventas` (`anulada_por`/`motivo_anulacion`) + aperturas/cierres
      de `turnos_caja`, normalizado a columnas comunes (fecha, usuario,
      tipo, detalle, monto).
- [ ] Filtros: usuario, rango de fecha, tipo de movimiento.
- [ ] Insignia de color por tipo (salida de stock / recargo / anulación
      en `--alerta`, igual que el resto del sistema de diseño).

## Fase 5 — Ocultar/gatear lo que ya existe

- [ ] Stock: ocultar "Nuevo producto", "Editar", "Eliminar", "Rubros",
      "Importar Excel", "Exportar Excel" para operador. Ocultar campo
      "Precio de venta" en `FormularioAjusteStock.tsx` (único que lo
      tiene — `FormularioCargaRapida.tsx` nunca lo pidió, revisado en
      Fase 0). Motivo de salida ya quedó obligatorio para los dos roles
      desde Fase 0, no hace falta nada más acá.
- [ ] Clientes: ocultar el campo "% de recargo" y "Exportar" en
      `PanelCuentaCorriente.tsx` para operador.
- [ ] Caja: ocultar `HistorialCierres` completo salvo filas propias (o
      confiar en que la policy de Fase 1 ya devuelve solo esas filas) y
      ocultar `BotonExportarCaja`.
- [ ] Proveedores: ocultar "Editar", "+ Nuevo proveedor", "Eliminar".

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
