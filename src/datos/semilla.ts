import { CTA } from '../dominio/calculos'
import { hace } from '../dominio/formato'
import { TODAS_LAS_OPCIONES } from '../dominio/permisos'
import type { AcuseFel, Estado, Producto, Rol, SerieDocumento, Socio, Sucursal } from '../dominio/tipos'
import { descuadre, saldoCuenta, valorInventario } from './consultas'
import { armarDte } from './dte'
import {
  aplicarCertificacion,
  asientoManual,
  cargarSaldosIniciales,
  crearOrdenCompra,
  crearOrdenVenta,
  crearRuta,
  emitirFactura,
  entregarEnMostrador,
  iniciarRuta,
  marcarParada,
  recibirOrdenCompra,
  registrarCobro,
  type Resultado,
} from './motor'

export const CLAVE_DEMO = 'manantial'

export const CUENTAS_DEMO = [
  { id: 'usr-admin', nombre: 'Ana Lucía Morales', correo: 'admin@manantial.gt', rol: 'Administración', sucursalId: 'suc-z10', rolId: 'rol-admin', telefono: '+502 5200 1001' },
  { id: 'usr-conta', nombre: 'Carlos Hernández', correo: 'contador@manantial.gt', rol: 'Contabilidad', sucursalId: 'suc-z10', rolId: 'rol-conta', telefono: '+502 5200 1002' },
  { id: 'usr-ventas', nombre: 'Andrea Paz', correo: 'ventas.z10@manantial.gt', rol: 'Ventas Zona 10', sucursalId: 'suc-z10', rolId: 'rol-ventas', telefono: '+502 5200 1003' },
  { id: 'usr-bodega', nombre: 'Luis Chávez', correo: 'bodega@manantial.gt', rol: 'Bodega', sucursalId: 'suc-z10', rolId: 'rol-bodega', telefono: '+502 5200 1004' },
  { id: 'usr-ger', nombre: 'Marta Ixcot', correo: 'gerencia.mixco@manantial.gt', rol: 'Gerencia Mixco', sucursalId: 'suc-mix', rolId: 'rol-gerente', telefono: '+502 5200 1005' },
  { id: 'usr-juan', nombre: 'Juan Pérez', correo: 'juan.reparto@manantial.gt', rol: 'Repartidor', sucursalId: 'suc-z10', rolId: 'rol-reparto', telefono: '+502 5551 4410' },
  { id: 'usr-maria', nombre: 'María López', correo: 'maria.reparto@manantial.gt', rol: 'Repartidora', sucursalId: 'suc-mix', rolId: 'rol-reparto', telefono: '+502 5551 4411' },
  { id: 'usr-carlos', nombre: 'Carlos Méndez', correo: 'carlos.reparto@manantial.gt', rol: 'Repartidor', sucursalId: 'suc-vn', rolId: 'rol-reparto', telefono: '+502 5551 4412' },
]

function paso(r: Resultado): Estado {
  if (!r.ok || !r.estado) throw new Error(r.ok ? 'La operación no devolvió estado' : r.error)
  return r.estado
}

function listo(r: Resultado): { estado: Estado; id: string } {
  if (!r.ok || !r.id) throw new Error(r.ok ? 'Faltó el identificador' : r.error)
  return { estado: r.estado, id: r.id }
}

function serie(id: string, sucursalId: string, tipo: SerieDocumento['tipo'], prefijo: string, serieFel: string, correlativo: number): SerieDocumento {
  return { id, sucursalId, tipo, prefijo, serieFel, resolucion: 'Control interno de demostración', correlativo, hasta: 999999, activa: true }
}

function certificar(estado: Estado, facturaId: string, uuid: string): Estado {
  const armado = armarDte(estado, facturaId)
  if (!armado.ok) throw new Error(armado.error)
  const factura = estado.facturas.find((f) => f.id === facturaId)
  if (!factura) throw new Error('Factura perdida')
  armado.dte.fechaHoraEmision = `${factura.fecha}T11:30:00-06:00`
  const acuse: AcuseFel = {
    resultado: true,
    uuid,
    serie: armado.dte.serieEsperada,
    numero: String(armado.dte.numeroEsperado),
    fechaCertificacion: `${factura.fecha}T11:31:00-06:00`,
    errores: [],
  }
  return paso(aplicarCertificacion(estado, facturaId, acuse, armado.dte))
}

export function construirSemilla(): Estado {
  const sucursales: Sucursal[] = [
    { id: 'suc-z10', codigo: 'Z10', nombre: 'Matriz Zona 10', establecimientoSat: 1, direccion: '12 avenida 2-45, zona 10', municipio: 'Guatemala', departamento: 'Guatemala', codigoPostal: 1010, telefono: '+502 2308 4410', esMatriz: true, activa: true, lat: 14.5994, lng: -90.5138 },
    { id: 'suc-mix', codigo: 'MIX', nombre: 'Mixco San Cristóbal', establecimientoSat: 2, direccion: 'Boulevard San Cristóbal, sector B-1', municipio: 'Mixco', departamento: 'Guatemala', codigoPostal: 1057, telefono: '+502 2308 4420', esMatriz: false, activa: true, lat: 14.6688, lng: -90.5684 },
    { id: 'suc-vn', codigo: 'VN', nombre: 'Villa Nueva', establecimientoSat: 3, direccion: 'Calzada al Frutal 8-20, zona 4', municipio: 'Villa Nueva', departamento: 'Guatemala', codigoPostal: 1064, telefono: '+502 2308 4430', esMatriz: false, activa: true, lat: 14.5262, lng: -90.5872 },
  ]

  const roles: Rol[] = [
    { id: 'rol-admin', nombre: 'Administración', descripcion: 'Toda la operación, incluyendo la handheld.', alcance: 'empresa', esRepartidor: false, sistema: true, opciones: TODAS_LAS_OPCIONES },
    { id: 'rol-conta', nombre: 'Contabilidad', descripcion: 'Libros, facturas, cobros y certificación.', alcance: 'empresa', esRepartidor: false, sistema: true, opciones: ['dashboard.ver', 'socios.ver', 'ventas.ver', 'compras.ver', 'facturas.ver', 'facturas.emitir', 'facturas.cobrar', 'fel.ver', 'inventario.ver', 'contabilidad.ver', 'contabilidad.editar', 'series.ver', 'empresa.ver'] },
    { id: 'rol-ventas', nombre: 'Ventas', descripcion: 'Socios, órdenes, punto de venta y facturas de su sucursal.', alcance: 'sucursal', esRepartidor: false, sistema: true, opciones: ['dashboard.ver', 'socios.ver', 'socios.editar', 'ventas.ver', 'ventas.editar', 'pos.operar', 'facturas.ver', 'facturas.emitir', 'facturas.cobrar', 'rutas.ver'] },
    { id: 'rol-bodega', nombre: 'Bodega', descripcion: 'Compras, recepción e inventario.', alcance: 'sucursal', esRepartidor: false, sistema: true, opciones: ['dashboard.ver', 'socios.ver', 'compras.ver', 'compras.editar', 'inventario.ver', 'productos.editar'] },
    { id: 'rol-gerente', nombre: 'Gerencia de sucursal', descripcion: 'Opera su sucursal, el punto de venta y las rutas.', alcance: 'sucursal', esRepartidor: false, sistema: true, opciones: ['dashboard.ver', 'socios.ver', 'socios.editar', 'ventas.ver', 'ventas.editar', 'pos.operar', 'compras.ver', 'compras.editar', 'facturas.ver', 'facturas.emitir', 'facturas.cobrar', 'inventario.ver', 'rutas.ver', 'rutas.despachar', 'sucursales.ver', 'series.ver'] },
    { id: 'rol-reparto', nombre: 'Repartidor', descripcion: 'Solo la handheld de su ruta.', alcance: 'sucursal', esRepartidor: true, sistema: true, opciones: ['reparto.operar'] },
  ]

  const productos: Producto[] = [
    { id: 'prod-gar', sku: 'GAR-5G', nombre: 'Garrafón purificado 5 gal', unidad: 'UNI', bienOServicio: 'B', precio: 20, costo: 7.5, gravable: true, controlaInventario: true, minimo: 40, activo: true },
    { id: 'prod-bot', sku: 'BOT-600', nombre: 'Paquete 12 botellas 600 ml', unidad: 'PQT', bienOServicio: 'B', precio: 35, costo: 16, gravable: true, controlaInventario: true, minimo: 15, activo: true },
    { id: 'prod-bol', sku: 'BOL-5L', nombre: 'Bolsa de agua 5 litros', unidad: 'UNI', bienOServicio: 'B', precio: 9, costo: 2.8, gravable: true, controlaInventario: true, minimo: 30, activo: true },
    { id: 'prod-dis', sku: 'DIS-FC', nombre: 'Dispensador frío / calor', unidad: 'UNI', bienOServicio: 'B', precio: 499, costo: 310, gravable: true, controlaInventario: true, minimo: 2, activo: true },
    { id: 'prod-srv', sku: 'SRV-SEM', nombre: 'Servicio de ruta semanal', unidad: 'UNI', bienOServicio: 'S', precio: 25, costo: 0, gravable: true, controlaInventario: false, minimo: 0, activo: true },
  ]

  const socio = (parcial: Socio): Socio => parcial
  const socios: Socio[] = [
    socio({ id: 'soc-cf', codigo: 'SN-0001', nombre: 'Consumidor Final', nombreComercial: '', nit: 'CF', roles: ['cliente'], telefono: '', correo: '', direccion: 'Mostrador', municipio: 'Guatemala', departamento: 'Guatemala', sucursalId: 'suc-z10', lat: 14.5994, lng: -90.5138, limiteCredito: 0, diasCredito: 0, estado: 'activo', notas: 'Ventas de contado sin NIT.' }),
    socio({ id: 'soc-torre', codigo: 'SN-0002', nombre: 'Torres del Reformador, S.A.', nombreComercial: 'Torres del Reformador', nit: '8745126-8', roles: ['cliente'], telefono: '+502 2333 1001', correo: 'compras@torres.example', direccion: '14 calle 3-51, zona 10', municipio: 'Guatemala', departamento: 'Guatemala', sucursalId: 'suc-z10', lat: 14.5972, lng: -90.5118, limiteCredito: 8000, diasCredito: 15, estado: 'activo', notas: '' }),
    socio({ id: 'soc-hotel', codigo: 'SN-0003', nombre: 'Hotel Laguna Verde, S.A.', nombreComercial: 'Laguna Verde', nit: '5512093-K', roles: ['cliente'], telefono: '+502 2333 1002', correo: 'ama@lagunaverde.example', direccion: 'Diagonal 6 12-42, zona 10', municipio: 'Guatemala', departamento: 'Guatemala', sucursalId: 'suc-z10', lat: 14.6031, lng: -90.5164, limiteCredito: 12000, diasCredito: 8, estado: 'activo', notas: 'Entregar en muelle de servicio.' }),
    socio({ id: 'soc-clin', codigo: 'SN-0004', nombre: 'Clínicas del Valle, S.A.', nombreComercial: 'Clínicas del Valle', nit: '3922187-4', roles: ['cliente'], telefono: '+502 2333 1003', correo: 'bodega@clinicasvalle.example', direccion: '6 avenida 9-18, zona 10', municipio: 'Guatemala', departamento: 'Guatemala', sucursalId: 'suc-z10', lat: 14.5924, lng: -90.5086, limiteCredito: 6000, diasCredito: 15, estado: 'activo', notas: '' }),
    socio({ id: 'soc-oak', codigo: 'SN-0005', nombre: 'Condominio Oakland Plaza', nombreComercial: 'Oakland Plaza', nit: '1099334-K', roles: ['cliente'], telefono: '+502 2333 1004', correo: 'admin@oakland.example', direccion: '18 calle 5-22, zona 10', municipio: 'Guatemala', departamento: 'Guatemala', sucursalId: 'suc-z10', lat: 14.5902, lng: -90.5188, limiteCredito: 4000, diasCredito: 0, estado: 'activo', notas: '' }),
    socio({ id: 'soc-cafe', codigo: 'SN-0006', nombre: 'Cafetería Barista Nueve', nombreComercial: 'Barista Nueve', nit: '4481205-1', roles: ['cliente'], telefono: '+502 2333 1005', correo: 'hola@baristanueve.example', direccion: 'Avenida Las Américas 7-12, zona 13', municipio: 'Guatemala', departamento: 'Guatemala', sucursalId: 'suc-z10', lat: 14.5866, lng: -90.5215, limiteCredito: 1500, diasCredito: 0, estado: 'activo', notas: '' }),
    socio({ id: 'soc-coop', codigo: 'SN-0007', nombre: 'Cooperativa Integral del Valle', nombreComercial: 'Coop del Valle', nit: '2201984-K', roles: ['cliente'], telefono: '+502 2333 1006', correo: 'gerencia@coopvalle.example', direccion: 'Avenida Reforma 10-00, zona 9', municipio: 'Guatemala', departamento: 'Guatemala', sucursalId: 'suc-z10', lat: 14.6128, lng: -90.5152, limiteCredito: 5000, diasCredito: 8, estado: 'activo', notas: 'Dejar en recepción.' }),
    socio({ id: 'soc-gym', codigo: 'SN-0008', nombre: 'Gimnasio Atlas', nombreComercial: 'Atlas', nit: '6122008-3', roles: ['cliente'], telefono: '+502 2333 1007', correo: 'ops@atlasgym.example', direccion: '2 calle 14-30, zona 14', municipio: 'Guatemala', departamento: 'Guatemala', sucursalId: 'suc-z10', lat: 14.5818, lng: -90.5122, limiteCredito: 2000, diasCredito: 0, estado: 'activo', notas: 'Pedido de mostrador, pendiente de factura.' }),
    socio({ id: 'soc-asados', codigo: 'SN-0009', nombre: 'Asados Don Pedro', nombreComercial: 'Don Pedro', nit: '3001122-5', roles: ['cliente'], telefono: '+502 2444 2001', correo: 'pedidos@donpedro.example', direccion: 'Sector A, San Cristóbal', municipio: 'Mixco', departamento: 'Guatemala', sucursalId: 'suc-mix', lat: 14.6712, lng: -90.5628, limiteCredito: 2500, diasCredito: 7, estado: 'activo', notas: '' }),
    socio({ id: 'soc-tienda', codigo: 'SN-0010', nombre: 'Tienda San Cristóbal', nombreComercial: 'Tienda San Cristóbal', nit: '2883410-K', roles: ['cliente'], telefono: '+502 2444 2002', correo: 'tienda@sancris.example', direccion: 'Calle principal San Cristóbal', municipio: 'Mixco', departamento: 'Guatemala', sucursalId: 'suc-mix', lat: 14.6641, lng: -90.5746, limiteCredito: 1800, diasCredito: 0, estado: 'activo', notas: '' }),
    socio({ id: 'soc-taller', codigo: 'SN-0011', nombre: 'Taller Los Olivos', nombreComercial: 'Los Olivos', nit: '6155092-7', roles: ['cliente'], telefono: '+502 2444 2003', correo: 'taller@losolivos.example', direccion: 'El Naranjo, Mixco', municipio: 'Mixco', departamento: 'Guatemala', sucursalId: 'suc-mix', lat: 14.6495, lng: -90.5892, limiteCredito: 900, diasCredito: 0, estado: 'activo', notas: '' }),
    socio({ id: 'soc-cond', codigo: 'SN-0012', nombre: 'Condado San Nicolás', nombreComercial: 'San Nicolás', nit: '7733001-K', roles: ['cliente'], telefono: '+502 2444 2004', correo: 'admin@sannicolas.example', direccion: 'Condado San Nicolás, Mixco', municipio: 'Mixco', departamento: 'Guatemala', sucursalId: 'suc-mix', lat: 14.6764, lng: -90.5594, limiteCredito: 3000, diasCredito: 15, estado: 'activo', notas: '' }),
    socio({ id: 'soc-colegio', codigo: 'SN-0013', nombre: 'Colegio Monte Alto', nombreComercial: 'Monte Alto', nit: '1544778-2', roles: ['cliente'], telefono: '+502 2555 3001', correo: 'compras@montealto.example', direccion: 'Zona 4 de Villa Nueva', municipio: 'Villa Nueva', departamento: 'Guatemala', sucursalId: 'suc-vn', lat: 14.5314, lng: -90.5816, limiteCredito: 7000, diasCredito: 15, estado: 'activo', notas: '' }),
    socio({ id: 'soc-mercado', codigo: 'SN-0014', nombre: 'Comedor El Frutal', nombreComercial: 'El Frutal', nit: '5099182-K', roles: ['cliente'], telefono: '+502 2555 3002', correo: 'elfrutal@example.com', direccion: 'El Frutal, Villa Nueva', municipio: 'Villa Nueva', departamento: 'Guatemala', sucursalId: 'suc-vn', lat: 14.5408, lng: -90.5794, limiteCredito: 800, diasCredito: 0, estado: 'activo', notas: '' }),
    socio({ id: 'soc-ofi', codigo: 'SN-0015', nombre: 'Oficinas Nova', nombreComercial: 'Nova', nit: '4300118-9', roles: ['lead'], telefono: '+502 2333 1090', correo: 'hola@nova.example', direccion: 'Zona Pradera', municipio: 'Guatemala', departamento: 'Guatemala', sucursalId: 'suc-z10', lat: 14.5712, lng: -90.4955, limiteCredito: 0, diasCredito: 0, estado: 'activo', notas: 'Pidió cotización de 30 garrafones semanales. Todavía no es cliente.' }),
    socio({ id: 'soc-abar', codigo: 'SN-0016', nombre: 'Abarrotería La Esperanza', nombreComercial: 'La Esperanza', nit: '3188004-6', roles: ['lead'], telefono: '+502 2444 2090', correo: 'esperanza@example.com', direccion: 'Ciudad San Cristóbal', municipio: 'Mixco', departamento: 'Guatemala', sucursalId: 'suc-mix', lat: 14.6588, lng: -90.5602, limiteCredito: 0, diasCredito: 0, estado: 'activo', notas: 'Lead de ruta Mixco.' }),
    socio({ id: 'soc-plas', codigo: 'SN-0017', nombre: 'Plásticos del Atlántico, S.A.', nombreComercial: 'Plásticos del Atlántico', nit: '8877661-K', roles: ['proveedor'], telefono: '+502 2222 4400', correo: 'ventas@plasticosatlantico.example', direccion: 'Avenida Petapa 42-10, zona 12', municipio: 'Guatemala', departamento: 'Guatemala', sucursalId: 'suc-z10', lat: 14.5688, lng: -90.5412, limiteCredito: 0, diasCredito: 30, estado: 'activo', notas: 'Envases y tapas.' }),
    socio({ id: 'soc-quim', codigo: 'SN-0018', nombre: 'Químicos Andinos, S.A.', nombreComercial: 'Químicos Andinos', nit: '2244668-1', roles: ['proveedor'], telefono: '+502 2222 4500', correo: 'pedidos@quimicosandinos.example', direccion: 'Carretera a Villa Nueva km 14', municipio: 'Villa Nueva', departamento: 'Guatemala', sucursalId: 'suc-vn', lat: 14.5488, lng: -90.5722, limiteCredito: 0, diasCredito: 30, estado: 'activo', notas: 'Insumos de purificación.' }),
    socio({ id: 'soc-malo', codigo: 'SN-0019', nombre: 'Receptor de prueba SAT', nombreComercial: '', nit: '9999999-9', roles: ['cliente'], telefono: '', correo: 'rechazo@manantial.gt', direccion: 'Documento de prueba', municipio: 'Guatemala', departamento: 'Guatemala', sucursalId: 'suc-z10', lat: 14.5994, lng: -90.5138, limiteCredito: 0, diasCredito: 0, estado: 'activo', notas: 'El certificador simulado rechaza este NIT a propósito.' }),
  ]

  const series: SerieDocumento[] = [
    serie('ser-ov-z10', 'suc-z10', 'ORDEN_VENTA', 'OV-Z10', '', 510),
    serie('ser-oc-z10', 'suc-z10', 'ORDEN_COMPRA', 'OC-Z10', '', 40),
    serie('ser-fa-z10', 'suc-z10', 'FACTURA', 'FAC-Z10', 'A', 1840),
    serie('ser-nc-z10', 'suc-z10', 'NOTA_CREDITO', 'NC-Z10', 'A', 15),
    serie('ser-nd-z10', 'suc-z10', 'NOTA_DEBITO', 'ND-Z10', 'A', 1),
    serie('ser-rc-z10', 'suc-z10', 'RECIBO', 'RC-Z10', '', 220),
    serie('ser-ov-mix', 'suc-mix', 'ORDEN_VENTA', 'OV-MIX', '', 80),
    serie('ser-oc-mix', 'suc-mix', 'ORDEN_COMPRA', 'OC-MIX', '', 10),
    serie('ser-fa-mix', 'suc-mix', 'FACTURA', 'FAC-MIX', 'B', 210),
    serie('ser-nc-mix', 'suc-mix', 'NOTA_CREDITO', 'NC-MIX', 'B', 5),
    serie('ser-nd-mix', 'suc-mix', 'NOTA_DEBITO', 'ND-MIX', 'B', 1),
    serie('ser-rc-mix', 'suc-mix', 'RECIBO', 'RC-MIX', '', 40),
    serie('ser-ov-vn', 'suc-vn', 'ORDEN_VENTA', 'OV-VN', '', 60),
    serie('ser-oc-vn', 'suc-vn', 'ORDEN_COMPRA', 'OC-VN', '', 8),
    serie('ser-fa-vn', 'suc-vn', 'FACTURA', 'FAC-VN', 'C', 90),
    serie('ser-nc-vn', 'suc-vn', 'NOTA_CREDITO', 'NC-VN', 'C', 3),
    serie('ser-nd-vn', 'suc-vn', 'NOTA_DEBITO', 'ND-VN', 'C', 1),
    serie('ser-rc-vn', 'suc-vn', 'RECIBO', 'RC-VN', '', 20),
  ]

  let estado: Estado = {
    version: 1,
    empresa: {
      razonSocial: 'Purificadora Manantial, Sociedad Anónima',
      nombreComercial: 'Manantial',
      nit: '106048478',
      correo: 'facturacion@manantial.gt',
      telefono: '+502 2308 4410',
      direccion: '12 avenida 2-45, zona 10',
      municipio: 'Guatemala',
      departamento: 'Guatemala',
      codigoPostal: 1010,
    },
    fel: {
      proveedor: 'simulado',
      ambiente: 'pruebas',
      afiliacionIVA: 'GEN',
      fraseTipo: 1,
      fraseEscenario: 1,
      fraseTexto: 'Sujeto a pagos trimestrales ISR',
      numeroResolucion: '',
      fechaResolucion: '',
      usuario: '',
      token: '',
      endpoint: '',
    },
    sucursales,
    roles,
    usuarios: CUENTAS_DEMO.map((c) => ({ id: c.id, nombre: c.nombre, correo: c.correo, clave: CLAVE_DEMO, rolId: c.rolId, sucursalId: c.sucursalId, telefono: c.telefono, activo: true })),
    socios,
    productos,
    series,
    cuentas: [
      { id: '1101', codigo: '1101', nombre: 'Caja general', tipo: 'activo' },
      { id: '1102', codigo: '1102', nombre: 'Bancos', tipo: 'activo' },
      { id: '1201', codigo: '1201', nombre: 'Clientes', tipo: 'activo' },
      { id: '1202', codigo: '1202', nombre: 'IVA crédito fiscal', tipo: 'activo' },
      { id: '1301', codigo: '1301', nombre: 'Inventario de producto terminado', tipo: 'activo' },
      { id: '2101', codigo: '2101', nombre: 'Proveedores', tipo: 'pasivo' },
      { id: '2102', codigo: '2102', nombre: 'IVA débito fiscal', tipo: 'pasivo' },
      { id: '3101', codigo: '3101', nombre: 'Capital', tipo: 'patrimonio' },
      { id: '4101', codigo: '4101', nombre: 'Ventas', tipo: 'ingreso' },
      { id: '5101', codigo: '5101', nombre: 'Costo de ventas', tipo: 'costo' },
      { id: '6101', codigo: '6101', nombre: 'Gastos de distribución y flota', tipo: 'gasto' },
      { id: '6102', codigo: '6102', nombre: 'Gastos de administración', tipo: 'gasto' },
    ],
    ordenesVenta: [],
    ordenesCompra: [],
    facturas: [],
    asientos: [],
    movimientos: [],
    rutas: [],
    siguienteAsiento: 1,
    siguienteRuta: 48,
  }

  const cargas = [
    ['suc-z10', 'prod-gar', 420], ['suc-z10', 'prod-bot', 80], ['suc-z10', 'prod-bol', 160], ['suc-z10', 'prod-dis', 10],
    ['suc-mix', 'prod-gar', 260], ['suc-mix', 'prod-bot', 36], ['suc-mix', 'prod-bol', 90], ['suc-mix', 'prod-dis', 4],
    ['suc-vn', 'prod-gar', 180], ['suc-vn', 'prod-bot', 24], ['suc-vn', 'prod-bol', 70], ['suc-vn', 'prod-dis', 3],
  ].map(([sucursalId, productoId, cantidad]) => ({ sucursalId: String(sucursalId), productoId: String(productoId), cantidad: Number(cantidad) }))
  estado = paso(cargarSaldosIniciales(estado, cargas, 185000))

  estado = paso(crearOrdenCompra(estado, {
    sucursalId: 'suc-z10', socioId: 'soc-plas', fecha: hace(8), notas: 'Reposición de garrafón',
    lineas: [{ productoId: 'prod-gar', cantidad: 80, costoUnitario: 7.5 }],
  }))
  estado = paso(recibirOrdenCompra(estado, estado.ordenesCompra[0].id, hace(8)))

  const vender = (socioId: string, sucursalId: string, fecha: string, lineas: { productoId: string; cantidad: number }[], confirmar = true) => {
    const persona = estado.socios.find((s) => s.id === socioId)
    if (!persona?.lat || !persona.lng) throw new Error(`Sin ubicación ${socioId}`)
    const precio = (productoId: string) => estado.productos.find((p) => p.id === productoId)?.precio ?? 0
    const resultado = crearOrdenVenta(estado, {
      sucursalId,
      socioId,
      vendedorId: sucursalId === 'suc-mix' ? 'usr-ger' : 'usr-ventas',
      direccionEntrega: persona.direccion,
      lat: persona.lat,
      lng: persona.lng,
      ventana: '08:00–12:00',
      notas: '',
      fecha,
      confirmar,
      lineas: lineas.map((l) => ({ ...l, precioUnitario: precio(l.productoId), descuento: 0 })),
    })
    const creada = listo(resultado)
    estado = creada.estado
    return creada.id
  }

  const facturarMostrador = (socioId: string, sucursalId: string, fecha: string, lineas: { productoId: string; cantidad: number }[], uuid: string, cobro?: number) => {
    const ordenId = vender(socioId, sucursalId, fecha, lineas)
    estado = paso(entregarEnMostrador(estado, ordenId))
    const emitida = listo(emitirFactura(estado, ordenId, fecha))
    estado = emitida.estado
    estado = certificar(estado, emitida.id, uuid)
    if (cobro) estado = paso(registrarCobro(estado, emitida.id, cobro, 'transferencia', 'Depósito de demostración'))
  }

  facturarMostrador('soc-torre', 'suc-z10', hace(3), [{ productoId: 'prod-gar', cantidad: 12 }], 'A1B2C3D4-E5F6-47A8-9ABC-000000000101')
  facturarMostrador('soc-hotel', 'suc-z10', hace(2), [{ productoId: 'prod-gar', cantidad: 20 }, { productoId: 'prod-bot', cantidad: 4 }], 'A1B2C3D4-E5F6-47A8-9ABC-000000000102', 300)
  facturarMostrador('soc-colegio', 'suc-vn', hace(2), [{ productoId: 'prod-gar', cantidad: 16 }, { productoId: 'prod-bot', cantidad: 6 }], 'A1B2C3D4-E5F6-47A8-9ABC-000000000103', 530)

  estado = paso(asientoManual(estado, {
    fecha: hace(1),
    sucursalId: 'suc-z10',
    descripcion: 'Combustible de la flota',
    lineas: [
      { cuentaId: CTA.distribucion, detalle: 'Diésel de paneles', debe: 640, haber: 0 },
      { cuentaId: CTA.bancos, detalle: 'Transferencia', debe: 0, haber: 640 },
    ],
  }))

  const hoy = hace(0)
  const oak = vender('soc-oak', 'suc-z10', hoy, [{ productoId: 'prod-gar', cantidad: 10 }, { productoId: 'prod-srv', cantidad: 1 }])
  const hotelRuta = vender('soc-hotel', 'suc-z10', hoy, [{ productoId: 'prod-gar', cantidad: 8 }, { productoId: 'prod-bot', cantidad: 2 }])
  const clin = vender('soc-clin', 'suc-z10', hoy, [{ productoId: 'prod-gar', cantidad: 6 }, { productoId: 'prod-bol', cantidad: 4 }])
  const cafe = vender('soc-cafe', 'suc-z10', hoy, [{ productoId: 'prod-gar', cantidad: 12 }])
  const rutaJuan = listo(crearRuta(estado, { sucursalId: 'suc-z10', repartidorId: 'usr-juan', vehiculo: 'Panel 01', ordenIds: [oak, hotelRuta, clin, cafe], fecha: hoy }))
  estado = paso(iniciarRuta(rutaJuan.estado, rutaJuan.id))
  const paradaJuan = estado.rutas[0].paradas[0]
  estado = paso(marcarParada(estado, estado.rutas[0].id, paradaJuan.id, 'entregada'))

  const asados = vender('soc-asados', 'suc-mix', hoy, [{ productoId: 'prod-gar', cantidad: 10 }])
  const tienda = vender('soc-tienda', 'suc-mix', hoy, [{ productoId: 'prod-gar', cantidad: 8 }, { productoId: 'prod-bol', cantidad: 6 }])
  const taller = vender('soc-taller', 'suc-mix', hoy, [{ productoId: 'prod-gar', cantidad: 5 }])
  const cond = vender('soc-cond', 'suc-mix', hoy, [{ productoId: 'prod-gar', cantidad: 4 }, { productoId: 'prod-bot', cantidad: 1 }])
  const rutaMaria = listo(crearRuta(estado, { sucursalId: 'suc-mix', repartidorId: 'usr-maria', vehiculo: 'Panel 02', ordenIds: [asados, tienda, taller, cond], fecha: hoy }))
  estado = paso(iniciarRuta(rutaMaria.estado, rutaMaria.id))
  estado = paso(marcarParada(estado, estado.rutas[0].id, estado.rutas[0].paradas[0].id, 'entregada'))

  const colegio = vender('soc-colegio', 'suc-vn', hoy, [{ productoId: 'prod-gar', cantidad: 10 }])
  const mercado = vender('soc-mercado', 'suc-vn', hoy, [{ productoId: 'prod-gar', cantidad: 8 }, { productoId: 'prod-bol', cantidad: 4 }])
  const rutaCarlos = listo(crearRuta(estado, { sucursalId: 'suc-vn', repartidorId: 'usr-carlos', vehiculo: 'Panel 03', ordenIds: [colegio, mercado], fecha: hoy }))
  estado = paso(iniciarRuta(rutaCarlos.estado, rutaCarlos.id))
  estado = paso(marcarParada(estado, estado.rutas[0].id, estado.rutas[0].paradas[0].id, 'entregada'))
  estado = paso(marcarParada(estado, estado.rutas[0].id, estado.rutas[0].paradas.find((p) => p.estado === 'en_camino')!.id, 'entregada'))

  vender('soc-coop', 'suc-z10', hoy, [{ productoId: 'prod-gar', cantidad: 9 }])
  const gym = vender('soc-gym', 'suc-z10', hace(1), [{ productoId: 'prod-gar', cantidad: 6 }, { productoId: 'prod-srv', cantidad: 1 }])
  estado = paso(entregarEnMostrador(estado, gym))
  vender('soc-hotel', 'suc-z10', hoy, [{ productoId: 'prod-dis', cantidad: 1 }], false)

  estado = paso(crearOrdenCompra(estado, {
    sucursalId: 'suc-z10',
    socioId: 'soc-plas',
    fecha: hoy,
    notas: 'Pedido abierto de envase',
    lineas: [
      { productoId: 'prod-gar', cantidad: 60, costoUnitario: 7.5 },
      { productoId: 'prod-bot', cantidad: 20, costoUnitario: 16 },
    ],
  }))

  for (const ruta of estado.rutas) {
    if (ruta.estado === 'en_curso') ruta.legStartedAt = new Date(Date.now() - 22_000).toISOString()
  }

  const errorLibros = descuadre(estado)
  if (errorLibros) throw new Error(errorLibros)
  const diferencia = Math.abs(saldoCuenta(estado, CTA.inventario) - valorInventario(estado))
  if (diferencia > 0.05) throw new Error(`Inventario contable no cuadra con el kardex (${diferencia})`)
  return estado
}
