export interface Opcion {
  codigo: string
  modulo: string
  nombre: string
}

export const CATALOGO_OPCIONES: Opcion[] = [
  { codigo: 'dashboard.ver', modulo: 'General', nombre: 'Ver tablero' },
  { codigo: 'socios.ver', modulo: 'Comercial', nombre: 'Ver socios de negocio' },
  { codigo: 'socios.editar', modulo: 'Comercial', nombre: 'Crear y editar socios' },
  { codigo: 'ventas.ver', modulo: 'Comercial', nombre: 'Ver órdenes de venta' },
  { codigo: 'ventas.editar', modulo: 'Comercial', nombre: 'Crear y confirmar ventas' },
  { codigo: 'precios.ver', modulo: 'Comercial', nombre: 'Ver listas de precios' },
  { codigo: 'precios.editar', modulo: 'Comercial', nombre: 'Editar listas de precios' },
  { codigo: 'pos.operar', modulo: 'Comercial', nombre: 'Operar el punto de venta' },
  { codigo: 'compras.ver', modulo: 'Abastecimiento', nombre: 'Ver órdenes de compra' },
  { codigo: 'compras.editar', modulo: 'Abastecimiento', nombre: 'Crear y recibir compras' },
  { codigo: 'facturas.ver', modulo: 'Facturación', nombre: 'Ver facturas' },
  { codigo: 'facturas.emitir', modulo: 'Facturación', nombre: 'Emitir facturas y notas de crédito' },
  { codigo: 'facturas.cobrar', modulo: 'Facturación', nombre: 'Registrar cobros' },
  { codigo: 'analisis.ver', modulo: 'Facturación', nombre: 'Ver análisis de ventas y cuentas por cobrar' },
  { codigo: 'fel.ver', modulo: 'Facturación', nombre: 'Ver certificación FEL' },
  { codigo: 'fel.configurar', modulo: 'Facturación', nombre: 'Configurar certificador' },
  { codigo: 'inventario.ver', modulo: 'Inventario', nombre: 'Ver existencias' },
  { codigo: 'productos.editar', modulo: 'Inventario', nombre: 'Administrar productos' },
  { codigo: 'contabilidad.ver', modulo: 'Contabilidad', nombre: 'Ver libros y estados' },
  { codigo: 'contabilidad.editar', modulo: 'Contabilidad', nombre: 'Registrar asientos manuales' },
  { codigo: 'bancos.ver', modulo: 'Contabilidad', nombre: 'Ver cuentas bancarias' },
  { codigo: 'bancos.editar', modulo: 'Contabilidad', nombre: 'Registrar cuentas bancarias' },
  { codigo: 'activos.ver', modulo: 'Contabilidad', nombre: 'Ver la flota y sus activos' },
  { codigo: 'activos.editar', modulo: 'Contabilidad', nombre: 'Registrar vehículos' },
  { codigo: 'rutas.ver', modulo: 'Reparto', nombre: 'Monitorear rutas' },
  { codigo: 'rutas.despachar', modulo: 'Reparto', nombre: 'Armar y asignar rutas' },
  { codigo: 'reparto.operar', modulo: 'Reparto', nombre: 'Operar la handheld de reparto' },
  { codigo: 'sucursales.ver', modulo: 'Administración', nombre: 'Ver sucursales' },
  { codigo: 'sucursales.editar', modulo: 'Administración', nombre: 'Administrar sucursales' },
  { codigo: 'series.ver', modulo: 'Administración', nombre: 'Ver series de documentos' },
  { codigo: 'series.editar', modulo: 'Administración', nombre: 'Administrar series' },
  { codigo: 'seguridad.ver', modulo: 'Administración', nombre: 'Ver usuarios y roles' },
  { codigo: 'seguridad.editar', modulo: 'Administración', nombre: 'Crear roles y asignar opciones' },
  { codigo: 'empresa.ver', modulo: 'Administración', nombre: 'Ver datos de la empresa' },
  { codigo: 'empresa.editar', modulo: 'Administración', nombre: 'Editar razón social, NIT y contacto' },
]

export const TODAS_LAS_OPCIONES = CATALOGO_OPCIONES.map((o) => o.codigo)

export const ETIQUETA_SERIE: Record<string, string> = {
  ORDEN_VENTA: 'Orden de venta',
  ORDEN_COMPRA: 'Orden de compra',
  FACTURA: 'Factura',
  NOTA_CREDITO: 'Nota de crédito',
  NOTA_DEBITO: 'Nota de débito',
  RECIBO: 'Recibo de caja',
}

export const DEPARTAMENTOS = ['Guatemala', 'Sacatepéquez', 'Escuintla', 'Chimaltenango', 'Santa Rosa', 'El Progreso', 'Jutiapa', 'Quetzaltenango']

export const FRASES_ISR = [
  { tipo: 1, escenario: 1, texto: 'Sujeto a pagos trimestrales ISR' },
  { tipo: 1, escenario: 2, texto: 'Sujeto a retención definitiva ISR' },
  { tipo: 1, escenario: 3, texto: 'Sujeto a pago directo ISR' },
]

export const PROVEEDORES_FEL: { id: string; nombre: string }[] = [
  { id: 'simulado', nombre: 'Simulado (demostración)' },
  { id: 'infile', nombre: 'INFILE' },
  { id: 'digifact', nombre: 'Digifact' },
  { id: 'g4s', nombre: 'G4S' },
  { id: 'megaprint', nombre: 'Megaprint' },
  { id: 'otro', nombre: 'Otro certificador' },
]
