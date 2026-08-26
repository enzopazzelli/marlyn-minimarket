-- ============================================================
-- LIMPIEZA DE DATOS DE PRUEBA — 2026-08-26
--
-- Pedido del dueño: borrar el stock y las ventas, porque todo lo que
-- hay cargado es de la etapa de prueba. Rubros y proveedores también:
-- existen solo para clasificar esos productos.
--
-- ESTO NO ES UNA MIGRACIÓN. Vive fuera de supabase/migrations/ a
-- propósito: borra DATOS, no cambia el esquema, y no tiene que
-- reaplicarse nunca en una base nueva. Se corre a mano, una sola vez,
-- desde el SQL Editor del dashboard de Supabase.
--
-- ANTES DE CORRERLO: /reportes → "Descargar backup completo".
-- Guardá el .json en la raíz del repo como
-- backup_pre_wipe_2026-08-26.json (está gitignoreado, igual que los dos
-- anteriores). Sin ese archivo esto no se deshace.
--
-- QUÉ BORRA:
--   ventas + ítems + pagos            todas
--   movimientos_stock                 todos
--   movimientos_cuenta_corriente      todos (fiados, pagos, recargos)
--   movimientos_caja + turnos_caja    todos
--   productos                         todos
--   categorias + proveedores          todos
--   clientes                          todos, con ficha y todo
--
-- QUÉ NO TOCA:
--   perfiles, auth.users              los usuarios del sistema: si se
--                                     borran, nadie puede entrar
--   notas                             el bloc de notas del local, no
--                                     es dato transaccional
--
-- El orden respeta las foreign keys: los movimientos antes que las
-- ventas; las ventas antes que los turnos y los productos; los
-- productos antes que rubros y proveedores; los clientes al final. Va
-- todo en una transacción — si algo falla, no se borra nada.
-- ============================================================

begin;

-- 1) Todo lo que apunta a ventas
delete from public.movimientos_cuenta_corriente;
delete from public.ventas_pagos;
delete from public.ventas_items;
delete from public.movimientos_stock;

-- 2) Las ventas (ya sin nada que las referencie)
delete from public.ventas;

-- 3) Caja: los ingresos por venta que quedaron sin venta detrás, y los
--    turnos. Si no se borran, el primer arqueo real arranca con
--    historial inventado.
delete from public.movimientos_caja;
delete from public.turnos_caja;

-- 4) El catálogo (ya sin ventas_items ni movimientos_stock apuntando)
delete from public.productos;

-- 5) Rubros y proveedores, que existían solo para esos productos. Van
--    después de productos por prolijidad: las FK son `on delete set
--    null`, así que borrarlos antes no fallaría, pero dejaría los
--    productos huérfanos durante la transacción.
delete from public.categorias;
delete from public.proveedores;

-- 6) Los clientes. Va último: movimientos_cuenta_corriente y ventas ya
--    no los referencian. No hace falta poner el saldo en cero antes —
--    la fila entera se va.
delete from public.clientes;

-- Control: TODAS estas tienen que dar 0.
select
  (select count(*) from public.productos) as productos,
  (select count(*) from public.categorias) as categorias,
  (select count(*) from public.proveedores) as proveedores,
  (select count(*) from public.ventas) as ventas,
  (select count(*) from public.ventas_items) as ventas_items,
  (select count(*) from public.ventas_pagos) as ventas_pagos,
  (select count(*) from public.movimientos_stock) as mov_stock,
  (select count(*) from public.movimientos_cuenta_corriente) as mov_cta_cte,
  (select count(*) from public.movimientos_caja) as mov_caja,
  (select count(*) from public.turnos_caja) as turnos,
  (select count(*) from public.clientes) as clientes;

-- Revisá el resultado de arriba ANTES de confirmar.
-- Si está bien:   commit;
-- Si algo no cuadra:  rollback;
commit;
