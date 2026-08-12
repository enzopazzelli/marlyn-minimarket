-- M1 Stock: guarda cómo se llegó al precio de venta (costo + % de
-- ganancia + IVA opcional) para que el alta/edición de producto pueda
-- reconstruir la calculadora en vez de arrancar en blanco. No participa
-- del ticket (que sigue sin discriminar IVA, config/cliente.ts
-- reglasNegocio.ivaDiscriminado) ni de ninguna función de venta: es
-- solo un dato de apoyo para cargar precios más rápido.

alter table public.productos
  add column incluye_iva boolean not null default true,
  add column porcentaje_ganancia numeric(6, 2);
