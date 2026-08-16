// Configuración propia de Mini Market Marlyn. Apagar un módulo acá debe
// ocultar su navegación, sus rutas y sus permisos, sin borrar código.
// Ver prompt-base-sistemas-gestion.md, sección 2, "Reglas de modularidad".

export const clienteConfig = {
  comercio: {
    nombre: "Mini Market Marlyn",
    rubro: "Minimarket / despensa",
  },

  modulos: {
    stock: true,
    clientes: true,
    ventas: true,
    caja: true,
    // Catálogo de proveedores (ficha, productos que provee, generar
    // pedido de texto) — no es M6 Compras completo (orden de
    // compra/recepción formal), eso sigue en `compras`.
    proveedores: true,
    // Notas sueltas de uso general (texto libre + fecha) — pegar el
    // pedido que se le mandó a un proveedor, un recordatorio, etc.
    notas: true,
    // Dashboard de indicadores del día (ventas, balance, medios de
    // pago, top productos, alertas de stock) + export a Excel — no
    // incluye alertas de vencimiento ni metas configurables, quedan
    // afuera hasta que haya dónde cargar esos datos.
    reportes: true,
    // Fase 2, fuera del alcance de esta entrega:
    panel: false,
    compras: false,
    usuariosGranular: false,
    promociones: false,
  },

  // Se cotizan aparte del software base (sección 2, "Complementos").
  complementos: {
    // Pedido explícitamente desde el día 1 por el cliente, a diferencia
    // de impresión y facturación que quedan para una segunda etapa.
    pantallaCliente: true,
    impresionTickets: false,
    facturacionFiscal: false,
  },

  // Reglas de negocio parametrizables (sección 3): nunca hardcodear un
  // `if` por cliente, esto es lo que cambia entre proyectos.
  reglasNegocio: {
    // Confirmado con el cliente: si no hay stock cargado, no se vende.
    permiteStockNegativo: false,
    // Confirmado: el fiado se registra, sin límite que bloquee la venta.
    limiteFiadoDuroActivo: false,
    moneda: "ARS",
    ivaDiscriminado: false,
    // Usado por la calculadora de precio de venta en el alta de
    // productos (costo + % ganancia + IVA opcional), no por el ticket
    // (que sigue sin discriminar IVA — ver `ivaDiscriminado`). Mismo
    // valor que `IVA_RATE` en miadmin/core/config.py.
    ivaPorcentaje: 21,
  },
} as const;

export type ClienteConfig = typeof clienteConfig;
