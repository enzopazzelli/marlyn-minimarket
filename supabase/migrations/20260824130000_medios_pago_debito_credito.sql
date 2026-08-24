-- Pedido explícito del cliente: Débito y Crédito en vez de QR. Como la
-- base se vació para la entrega (no quedan ventas_pagos viejos con
-- medio='qr'), es un reemplazo directo, sin dato que migrar.

alter table public.ventas_pagos drop constraint ventas_pagos_medio_check;

alter table public.ventas_pagos
  add constraint ventas_pagos_medio_check
  check (medio in ('efectivo', 'transferencia', 'debito', 'credito', 'fiado'));
