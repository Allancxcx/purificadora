import { CTA, nid, redondear, totalesCompra, totalesVenta } from '../dominio/calculos'
import { fechaGT, folio, nitLimpio, nitValido } from '../dominio/formato'
import type {
  AcuseFel,
  Asiento,
  ConfigFel,
  DteFel,
  Empresa,
  Estado,
  FormaCobro,
  LineaAsiento,
  LineaComercial,
  LineaCompra,
  OrdenVenta,
  Producto,
  Rol,
  SerieDocumento,
  Socio,
  Sucursal,
  TipoSerie,
  Usuario,
} from '../dominio/tipos'
import { facturaVigente, serieActiva, stock } from './consultas'

export type Resultado =
  | { ok: true; estado: Estado; id?: string; aviso?: string }
  | { ok: false; error: string; estado?: Estado }

function clonar(estado: Estado): Estado {
  return structuredClone(estado)
}

function tomarNumero(estado: Estado, serieId: string): { numero: number } | { error: string } {
  const serie = estado.series.find((s) => s.id === serieId)
  if (!serie?.activa) return { error: 'La serie no está activa.' }
  if (serie.correlativo > serie.hasta) return { error: `La serie ${serie.prefijo} llegó a su límite.` }
  const numero = serie.correlativo
  serie.correlativo += 1
  return { numero }
}

function registrarAsiento(estado: Estado, input: Omit<Asiento, 'id' | 'numero'>): { id: string } | { error: string } {
  const lineas = input.lineas
    .map((l) => ({ ...l, debe: redondear(l.debe), haber: redondear(l.haber) }))
    .filter((l) => l.debe !== 0 || l.haber !== 0)
  if (lineas.length < 2) return { error: 'El asiento necesita al menos dos líneas con monto.' }
  const debe = redondear(lineas.reduce((s, l) => s + l.debe, 0))
  const haber = redondear(lineas.reduce((s, l) => s + l.haber, 0))
  if (debe !== haber) return { error: `El asiento no cuadra. Debe ${debe} y haber ${haber}.` }
  const id = nid('ast')
  estado.asientos.push({ ...input, id, numero: estado.siguienteAsiento, lineas })
  estado.siguienteAsiento += 1
  return { id }
}

function faltaStock(estado: Estado, sucursalId: string, lineas: { productoId: string; cantidad: number; controlaInventario: boolean; descripcion: string }[]): string | null {
  const pedido = new Map<string, { cantidad: number; descripcion: string }>()
  for (const linea of lineas) {
    if (!linea.controlaInventario) continue
    const previo = pedido.get(linea.productoId)
    pedido.set(linea.productoId, { cantidad: (previo?.cantidad ?? 0) + linea.cantidad, descripcion: linea.descripcion })
  }
  for (const [productoId, info] of pedido) {
    const hay = stock(estado, sucursalId, productoId)
    if (hay + 0.0001 < info.cantidad) return `Sin existencia de ${info.descripcion}. Hay ${hay} y hacen falta ${info.cantidad}.`
  }
  return null
}

function salidaInventario(estado: Estado, orden: OrdenVenta, referencia: string, concepto: string, fecha: string) {
  for (const linea of orden.lineas) {
    if (!linea.controlaInventario) continue
    estado.movimientos.push({
      id: nid('mov'),
      fecha,
      sucursalId: orden.sucursalId,
      productoId: linea.productoId,
      tipo: 'salida',
      cantidad: linea.cantidad,
      referencia,
      concepto,
    })
  }
}

function entradaInventario(estado: Estado, orden: OrdenVenta, referencia: string, concepto: string, fecha: string) {
  for (const linea of orden.lineas) {
    if (!linea.controlaInventario) continue
    estado.movimientos.push({
      id: nid('mov'),
      fecha,
      sucursalId: orden.sucursalId,
      productoId: linea.productoId,
      tipo: 'entrada',
      cantidad: linea.cantidad,
      referencia,
      concepto,
    })
  }
}

function costoOrden(orden: OrdenVenta): number {
  return redondear(orden.lineas.filter((l) => l.controlaInventario).reduce((s, l) => s + redondear(l.cantidad * l.costoUnitario), 0))
}

function exigirSerie(estado: Estado, sucursalId: string, tipo: TipoSerie): SerieDocumento | { error: string } {
  const serie = serieActiva(estado, sucursalId, tipo)
  if (!serie) return { error: `No hay serie activa de ${tipo.replaceAll('_', ' ').toLowerCase()} en la sucursal.` }
  return serie
}

export interface CargaInicial {
  sucursalId: string
  productoId: string
  cantidad: number
}

export function cargarSaldosIniciales(entrada: Estado, cargas: CargaInicial[], bancos: number): Resultado {
  const estado = clonar(entrada)
  let valor = 0
  for (const carga of cargas) {
    const producto = estado.productos.find((p) => p.id === carga.productoId)
    if (!producto) return { ok: false, error: 'Producto de apertura inexistente.' }
    valor = redondear(valor + redondear(carga.cantidad * producto.costo))
    estado.movimientos.push({
      id: nid('mov'),
      fecha: '2026-01-02',
      sucursalId: carga.sucursalId,
      productoId: carga.productoId,
      tipo: 'entrada',
      cantidad: carga.cantidad,
      referencia: 'APERTURA',
      concepto: 'Saldo inicial',
    })
  }
  const asiento = registrarAsiento(estado, {
    fecha: '2026-01-02',
    descripcion: 'Apertura del ejercicio de demostración',
    origen: 'apertura',
    sucursalId: 'suc-z10',
    lineas: [
      { cuentaId: CTA.bancos, detalle: 'Saldo en bancos', debe: bancos, haber: 0 },
      { cuentaId: CTA.inventario, detalle: 'Inventario inicial a costo estándar', debe: valor, haber: 0 },
      { cuentaId: CTA.capital, detalle: 'Capital', debe: 0, haber: redondear(bancos + valor) },
    ],
  })
  if ('error' in asiento) return { ok: false, error: asiento.error }
  return { ok: true, estado, aviso: 'Saldos iniciales cargados' }
}

export function guardarSocio(entrada: Estado, input: Omit<Socio, 'id' | 'codigo'> & { id?: string }): Resultado {
  const estado = clonar(entrada)
  if (input.nombre.trim().length < 3) return { ok: false, error: 'El nombre del socio es muy corto.' }
  if (!nitValido(input.nit)) return { ok: false, error: 'El NIT no tiene un formato utilizable. Usá CF o NIT con dígito verificador.' }
  if (input.roles.length === 0) return { ok: false, error: 'Indicá si es cliente, proveedor, lead o una combinación.' }
  const repetido = estado.socios.find((s) => nitLimpio(s.nit) === nitLimpio(input.nit) && s.id !== input.id && nitLimpio(input.nit) !== 'CF')
  if (repetido) return { ok: false, error: 'Ya existe un socio con ese NIT.' }
  if (input.id) {
    const actual = estado.socios.find((s) => s.id === input.id)
    if (!actual) return { ok: false, error: 'No encontré el socio.' }
    Object.assign(actual, input, { codigo: actual.codigo })
    return { ok: true, estado, id: actual.id, aviso: 'Socio actualizado' }
  }
  const consecutivo = estado.socios.reduce((max, s) => Math.max(max, Number(s.codigo.replace(/\D/g, '')) || 0), 0) + 1
  const socio: Socio = { ...input, id: nid('soc'), codigo: `SN-${String(consecutivo).padStart(4, '0')}` }
  estado.socios.unshift(socio)
  return { ok: true, estado, id: socio.id, aviso: `Socio ${socio.codigo} creado` }
}

export function guardarSucursal(entrada: Estado, input: Omit<Sucursal, 'id'> & { id?: string }): Resultado {
  const estado = clonar(entrada)
  if (!input.nombre.trim() || !input.codigo.trim()) return { ok: false, error: 'La sucursal necesita código y nombre.' }
  if (input.establecimientoSat < 1) return { ok: false, error: 'El establecimiento SAT empieza en 1.' }
  const choca = estado.sucursales.find((s) => s.id !== input.id && (s.codigo === input.codigo || s.establecimientoSat === input.establecimientoSat))
  if (choca) return { ok: false, error: 'El código o el establecimiento SAT ya está usado.' }
  if (input.id) {
    const actual = estado.sucursales.find((s) => s.id === input.id)
    if (!actual) return { ok: false, error: 'No encontré la sucursal.' }
    Object.assign(actual, input)
    return { ok: true, estado, id: actual.id, aviso: 'Sucursal actualizada' }
  }
  const sucursal: Sucursal = { ...input, id: nid('suc') }
  estado.sucursales.push(sucursal)
  return { ok: true, estado, id: sucursal.id, aviso: 'Sucursal creada' }
}

export function guardarSerie(entrada: Estado, input: Omit<SerieDocumento, 'id'> & { id?: string }): Resultado {
  const estado = clonar(entrada)
  if (!input.prefijo.trim()) return { ok: false, error: 'La serie necesita un prefijo.' }
  if (input.correlativo < 1 || input.hasta < input.correlativo) return { ok: false, error: 'El rango del correlativo no es válido.' }
  if ((input.tipo === 'FACTURA' || input.tipo === 'NOTA_CREDITO' || input.tipo === 'NOTA_DEBITO') && !input.serieFel.trim()) {
    return { ok: false, error: 'Las series fiscales necesitan el código de serie FEL, por ejemplo A.' }
  }
  if (input.activa) {
    const otra = estado.series.find((s) => s.id !== input.id && s.activa && s.sucursalId === input.sucursalId && s.tipo === input.tipo)
    if (otra) return { ok: false, error: 'Ya hay una serie activa de ese tipo en la sucursal. Desactivala antes.' }
  }
  if (input.id) {
    const actual = estado.series.find((s) => s.id === input.id)
    if (!actual) return { ok: false, error: 'No encontré la serie.' }
    if (input.correlativo < actual.correlativo) return { ok: false, error: 'El correlativo no puede retroceder.' }
    Object.assign(actual, input)
    return { ok: true, estado, id: actual.id, aviso: 'Serie actualizada' }
  }
  const serie: SerieDocumento = { ...input, id: nid('ser') }
  estado.series.push(serie)
  return { ok: true, estado, id: serie.id, aviso: 'Serie creada' }
}

export function guardarRol(entrada: Estado, input: Omit<Rol, 'id' | 'sistema'> & { id?: string }): Resultado {
  const estado = clonar(entrada)
  if (input.nombre.trim().length < 3) return { ok: false, error: 'El rol necesita un nombre.' }
  if (input.opciones.length === 0) return { ok: false, error: 'Asigná al menos una opción.' }
  const rol: Omit<Rol, 'id' | 'sistema'> & { id?: string } = {
    ...input,
    alcance: input.esRepartidor ? 'sucursal' : input.alcance,
  }
  if (rol.id) {
    const actual = estado.roles.find((r) => r.id === rol.id)
    if (!actual) return { ok: false, error: 'No encontré el rol.' }
    if (actual.sistema && actual.id === 'rol-admin') {
      actual.nombre = rol.nombre
      actual.descripcion = rol.descripcion
      actual.opciones = rol.opciones
      return { ok: true, estado, id: actual.id, aviso: 'Rol de administración actualizado' }
    }
    Object.assign(actual, rol, { sistema: actual.sistema })
    return { ok: true, estado, id: actual.id, aviso: 'Rol actualizado' }
  }
  const creado: Rol = { ...rol, id: nid('rol'), sistema: false }
  estado.roles.push(creado)
  return { ok: true, estado, id: creado.id, aviso: `Rol ${creado.nombre} creado` }
}

export function eliminarRol(entrada: Estado, id: string): Resultado {
  const estado = clonar(entrada)
  const rol = estado.roles.find((r) => r.id === id)
  if (!rol) return { ok: false, error: 'No encontré el rol.' }
  if (rol.sistema) return { ok: false, error: 'Ese rol es del sistema y no se elimina.' }
  if (estado.usuarios.some((u) => u.rolId === id)) return { ok: false, error: 'Hay usuarios con ese rol. Reasignalos primero.' }
  estado.roles = estado.roles.filter((r) => r.id !== id)
  return { ok: true, estado, aviso: 'Rol eliminado' }
}

export function guardarUsuario(entrada: Estado, input: Omit<Usuario, 'id'> & { id?: string }): Resultado {
  const estado = clonar(entrada)
  if (!input.nombre.trim() || !input.correo.includes('@')) return { ok: false, error: 'Nombre y correo son obligatorios.' }
  if (input.clave.trim().length < 4) return { ok: false, error: 'La clave necesita al menos 4 caracteres.' }
  if (estado.usuarios.some((u) => u.correo.toLowerCase() === input.correo.toLowerCase() && u.id !== input.id)) {
    return { ok: false, error: 'Ese correo ya tiene usuario.' }
  }
  if (!estado.roles.some((r) => r.id === input.rolId)) return { ok: false, error: 'Elegí un rol.' }
  if (input.id) {
    const actual = estado.usuarios.find((u) => u.id === input.id)
    if (!actual) return { ok: false, error: 'No encontré el usuario.' }
    Object.assign(actual, { ...input, correo: input.correo.toLowerCase() })
    return { ok: true, estado, id: actual.id, aviso: 'Usuario actualizado' }
  }
  const usuario: Usuario = { ...input, id: nid('usr'), correo: input.correo.toLowerCase() }
  estado.usuarios.push(usuario)
  return { ok: true, estado, id: usuario.id, aviso: 'Usuario creado' }
}

export function guardarProducto(entrada: Estado, input: Omit<Producto, 'id'> & { id?: string }): Resultado {
  const estado = clonar(entrada)
  if (!input.sku.trim() || !input.nombre.trim()) return { ok: false, error: 'SKU y nombre son obligatorios.' }
  if (input.unidad.trim().length < 1 || input.unidad.trim().length > 3) return { ok: false, error: 'La unidad de medida SAT admite de 1 a 3 caracteres. Ejemplo: UNI.' }
  if (input.precio < 0 || input.costo < 0) return { ok: false, error: 'Precio y costo no pueden ser negativos.' }
  if (estado.productos.some((p) => p.sku.toLowerCase() === input.sku.toLowerCase() && p.id !== input.id)) {
    return { ok: false, error: 'Ese SKU ya existe.' }
  }
  const producto = { ...input, sku: input.sku.toUpperCase(), unidad: input.unidad.toUpperCase() }
  if (producto.id) {
    const actual = estado.productos.find((p) => p.id === producto.id)
    if (!actual) return { ok: false, error: 'No encontré el producto.' }
    Object.assign(actual, producto)
    return { ok: true, estado, id: actual.id, aviso: 'Producto actualizado' }
  }
  const creado: Producto = { ...producto, id: nid('prd') }
  estado.productos.push(creado)
  return { ok: true, estado, id: creado.id, aviso: 'Producto creado' }
}

export interface NuevaVenta {
  sucursalId: string
  socioId: string
  vendedorId: string
  direccionEntrega: string
  lat: number
  lng: number
  ventana: string
  notas: string
  fecha?: string
  confirmar: boolean
  lineas: { productoId: string; cantidad: number; precioUnitario: number; descuento: number }[]
}

function construirLineas(estado: Estado, lineas: NuevaVenta['lineas']): LineaComercial[] | { error: string } {
  if (lineas.length === 0) return { error: 'Agregá al menos un producto.' }
  const armadas: LineaComercial[] = []
  for (const linea of lineas) {
    const producto = estado.productos.find((p) => p.id === linea.productoId && p.activo)
    if (!producto) return { error: 'Hay un producto inactivo o inexistente.' }
    if (linea.cantidad <= 0) return { error: 'La cantidad tiene que ser mayor a cero.' }
    const bruto = linea.cantidad * linea.precioUnitario
    if (linea.descuento < 0 || linea.descuento > bruto) return { error: `El descuento de ${producto.nombre} pasa del importe.` }
    armadas.push({
      id: nid('lin'),
      productoId: producto.id,
      descripcion: producto.nombre,
      bienOServicio: producto.bienOServicio,
      unidad: producto.unidad,
      cantidad: linea.cantidad,
      precioUnitario: redondear(linea.precioUnitario),
      descuento: redondear(linea.descuento),
      costoUnitario: producto.costo,
      gravable: producto.gravable,
      controlaInventario: producto.controlaInventario,
    })
  }
  return armadas
}

export function crearOrdenVenta(entrada: Estado, input: NuevaVenta): Resultado {
  const estado = clonar(entrada)
  const socio = estado.socios.find((s) => s.id === input.socioId && s.estado === 'activo')
  if (!socio?.roles.includes('cliente')) return { ok: false, error: 'La orden necesita un socio activo con rol de cliente.' }
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return { ok: false, error: 'La entrega necesita ubicación.' }
  const serie = exigirSerie(estado, input.sucursalId, 'ORDEN_VENTA')
  if ('error' in serie) return { ok: false, error: serie.error }
  const lineas = construirLineas(estado, input.lineas)
  if ('error' in lineas) return { ok: false, error: lineas.error }
  const numero = tomarNumero(estado, serie.id)
  if ('error' in numero) return { ok: false, error: numero.error }
  const orden: OrdenVenta = {
    id: nid('ov'),
    sucursalId: input.sucursalId,
    socioId: socio.id,
    vendedorId: input.vendedorId,
    serieId: serie.id,
    numero: numero.numero,
    fecha: input.fecha ?? fechaGT(),
    estado: input.confirmar ? 'confirmada' : 'borrador',
    direccionEntrega: input.direccionEntrega.trim() || socio.direccion,
    lat: input.lat,
    lng: input.lng,
    ventana: input.ventana || '08:00–12:00',
    notas: input.notas,
    lineas,
    origenInventario: null,
  }
  estado.ordenesVenta.unshift(orden)
  return { ok: true, estado, id: orden.id, aviso: `Orden ${folio(serie.prefijo, orden.numero)} lista` }
}

export function confirmarOrdenVenta(entrada: Estado, id: string): Resultado {
  const estado = clonar(entrada)
  const orden = estado.ordenesVenta.find((o) => o.id === id)
  if (!orden) return { ok: false, error: 'No encontré la orden.' }
  if (orden.estado !== 'borrador') return { ok: false, error: 'Solo un borrador se puede confirmar.' }
  orden.estado = 'confirmada'
  return { ok: true, estado, id, aviso: 'Orden confirmada' }
}

export function anularOrdenVenta(entrada: Estado, id: string): Resultado {
  const estado = clonar(entrada)
  const orden = estado.ordenesVenta.find((o) => o.id === id)
  if (!orden) return { ok: false, error: 'No encontré la orden.' }
  if (orden.estado !== 'borrador' && orden.estado !== 'confirmada') return { ok: false, error: 'Esa orden ya está en ruta, entregada o anulada.' }
  if (facturaVigente(estado, id)) return { ok: false, error: 'Primero descartá la factura de esta orden.' }
  if (orden.origenInventario) return { ok: false, error: 'Esta orden ya movió inventario.' }
  orden.estado = 'anulada'
  return { ok: true, estado, aviso: 'Orden anulada. El correlativo no se reutiliza.' }
}

export function entregarEnMostrador(entrada: Estado, id: string): Resultado {
  const estado = clonar(entrada)
  const orden = estado.ordenesVenta.find((o) => o.id === id)
  if (!orden || orden.estado !== 'confirmada') return { ok: false, error: 'Solo una orden confirmada se entrega en mostrador.' }
  orden.estado = 'entregada'
  return { ok: true, estado, aviso: 'Entrega de mostrador registrada. El inventario sale al certificar la factura.' }
}

export interface NuevaCompra {
  sucursalId: string
  socioId: string
  notas: string
  fecha?: string
  lineas: { productoId: string; cantidad: number; costoUnitario: number }[]
}

export function crearOrdenCompra(entrada: Estado, input: NuevaCompra): Resultado {
  const estado = clonar(entrada)
  const socio = estado.socios.find((s) => s.id === input.socioId && s.estado === 'activo')
  if (!socio?.roles.includes('proveedor')) return { ok: false, error: 'La compra necesita un socio proveedor.' }
  const serie = exigirSerie(estado, input.sucursalId, 'ORDEN_COMPRA')
  if ('error' in serie) return { ok: false, error: serie.error }
  if (input.lineas.length === 0) return { ok: false, error: 'Agregá productos a la compra.' }
  const lineas: LineaCompra[] = []
  for (const linea of input.lineas) {
    const producto = estado.productos.find((p) => p.id === linea.productoId)
    if (!producto) return { ok: false, error: 'Producto inexistente.' }
    if (linea.cantidad <= 0 || linea.costoUnitario < 0) return { ok: false, error: 'Revisá cantidad y costo.' }
    lineas.push({
      id: nid('lin'),
      productoId: producto.id,
      descripcion: producto.nombre,
      cantidad: linea.cantidad,
      costoUnitario: redondear(linea.costoUnitario),
      gravable: producto.gravable,
      controlaInventario: producto.controlaInventario,
    })
  }
  const numero = tomarNumero(estado, serie.id)
  if ('error' in numero) return { ok: false, error: numero.error }
  const orden = {
    id: nid('oc'),
    sucursalId: input.sucursalId,
    socioId: socio.id,
    serieId: serie.id,
    numero: numero.numero,
    fecha: input.fecha ?? fechaGT(),
    estado: 'borrador' as const,
    notas: input.notas,
    lineas,
  }
  estado.ordenesCompra.unshift(orden)
  return { ok: true, estado, id: orden.id, aviso: `Compra ${folio(serie.prefijo, orden.numero)} creada` }
}

export function recibirOrdenCompra(entrada: Estado, id: string, fecha?: string): Resultado {
  const estado = clonar(entrada)
  const orden = estado.ordenesCompra.find((o) => o.id === id)
  if (!orden || orden.estado !== 'borrador') return { ok: false, error: 'Solo se recibe una orden de compra en borrador.' }
  const dia = fecha ?? fechaGT()
  const serie = estado.series.find((s) => s.id === orden.serieId)
  const totales = totalesCompra(orden.lineas)
  for (const linea of orden.lineas) {
    if (!linea.controlaInventario) continue
    estado.movimientos.push({
      id: nid('mov'),
      fecha: dia,
      sucursalId: orden.sucursalId,
      productoId: linea.productoId,
      tipo: 'entrada',
      cantidad: linea.cantidad,
      referencia: folio(serie?.prefijo ?? 'OC', orden.numero),
      concepto: 'Recepción de compra',
    })
  }
  const asiento = registrarAsiento(estado, {
    fecha: dia,
    descripcion: `Recepción ${folio(serie?.prefijo ?? 'OC', orden.numero)}`,
    origen: 'compra',
    origenId: orden.id,
    sucursalId: orden.sucursalId,
    lineas: [
      { cuentaId: CTA.inventario, detalle: 'Ingreso a bodega', debe: totales.baseInventario, haber: 0 },
      { cuentaId: CTA.administracion, detalle: 'Gasto no inventariable', debe: totales.baseGasto, haber: 0 },
      { cuentaId: CTA.ivaCredito, detalle: 'IVA crédito fiscal', debe: totales.iva, haber: 0 },
      { cuentaId: CTA.proveedores, detalle: 'Cuenta por pagar', debe: 0, haber: totales.total },
    ],
  })
  if ('error' in asiento) return { ok: false, error: asiento.error }
  orden.estado = 'recibida'
  orden.asientoId = asiento.id
  return { ok: true, estado, aviso: 'Compra recibida, inventario y asiento actualizados' }
}

export function anularOrdenCompra(entrada: Estado, id: string): Resultado {
  const estado = clonar(entrada)
  const orden = estado.ordenesCompra.find((o) => o.id === id)
  if (!orden || orden.estado !== 'borrador') return { ok: false, error: 'Solo se anula una compra que todavía no entra a bodega.' }
  orden.estado = 'anulada'
  return { ok: true, estado, aviso: 'Orden de compra anulada' }
}

export function emitirFactura(entrada: Estado, ordenId: string, fecha?: string): Resultado {
  const estado = clonar(entrada)
  const orden = estado.ordenesVenta.find((o) => o.id === ordenId)
  if (!orden || orden.estado === 'anulada' || orden.estado === 'borrador') {
    return { ok: false, error: 'Confirmá la orden antes de facturar.' }
  }
  if (facturaVigente(estado, ordenId)) return { ok: false, error: 'Esa orden ya tiene una factura vigente.' }
  const serie = exigirSerie(estado, orden.sucursalId, 'FACTURA')
  if ('error' in serie) return { ok: false, error: serie.error }
  const totales = totalesVenta(orden.lineas)
  if (totales.total <= 0) return { ok: false, error: 'La factura no tiene importe.' }
  const factura: Estado['facturas'][number] = {
    id: nid('fac'),
    tipo: 'FACT',
    sucursalId: orden.sucursalId,
    socioId: orden.socioId,
    ordenVentaId: orden.id,
    serieId: serie.id,
    numero: null,
    fecha: fecha ?? fechaGT(),
    estado: 'abierta',
    lineas: structuredClone(orden.lineas),
    motivo: '',
    acuse: null,
    dte: null,
    cobros: [],
    movioInventario: false,
    ajustada: false,
  }
  estado.facturas.unshift(factura)
  return { ok: true, estado, id: factura.id, aviso: 'Factura abierta. Todavía no consume correlativo.' }
}

function notaVigente(estado: Estado, facturaId: string) {
  return estado.facturas.some((f) => f.facturaOrigenId === facturaId && f.estado !== 'cancelada')
}

export function emitirNota(entrada: Estado, facturaId: string, tipo: 'NCRE' | 'NDEB', motivo: string): Resultado {
  const estado = clonar(entrada)
  const origen = estado.facturas.find((f) => f.id === facturaId)
  if (!origen || origen.tipo !== 'FACT' || origen.estado !== 'cerrada') {
    return { ok: false, error: 'La nota sale de una factura cerrada.' }
  }
  if (origen.ajustada) return { ok: false, error: 'Esa factura ya fue ajustada.' }
  if (tipo === 'NCRE' && origen.cobros.length > 0) {
    return { ok: false, error: 'La factura ya tiene cobros. La nota de crédito total solo procede con el saldo intacto.' }
  }
  if (notaVigente(estado, origen.id)) return { ok: false, error: 'Ya hay una nota abierta o cerrada para esa factura.' }
  const serie = exigirSerie(estado, origen.sucursalId, tipo === 'NCRE' ? 'NOTA_CREDITO' : 'NOTA_DEBITO')
  if ('error' in serie) return { ok: false, error: serie.error }
  const nota: Estado['facturas'][number] = {
    id: nid(tipo === 'NCRE' ? 'nc' : 'nd'),
    tipo,
    sucursalId: origen.sucursalId,
    socioId: origen.socioId,
    ordenVentaId: origen.ordenVentaId,
    facturaOrigenId: origen.id,
    serieId: serie.id,
    numero: null,
    fecha: fechaGT(),
    estado: 'abierta',
    lineas: structuredClone(origen.lineas),
    motivo: motivo.trim() || (tipo === 'NCRE' ? 'Ajuste a favor del cliente' : 'Ajuste a cargo del cliente'),
    acuse: null,
    dte: null,
    cobros: [],
    movioInventario: false,
    ajustada: false,
  }
  estado.facturas.unshift(nota)
  const nombre = tipo === 'NCRE' ? 'Nota de crédito' : 'Nota de débito'
  return { ok: true, estado, id: nota.id, aviso: `${nombre} abierta. Certificala para que llegue a la SAT.` }
}

export function emitirNotaCredito(entrada: Estado, facturaId: string, motivo: string): Resultado {
  return emitirNota(entrada, facturaId, 'NCRE', motivo)
}

export function emitirNotaDebito(entrada: Estado, facturaId: string, motivo: string): Resultado {
  return emitirNota(entrada, facturaId, 'NDEB', motivo)
}

export function cancelarDocumento(entrada: Estado, facturaId: string): Resultado {
  const estado = clonar(entrada)
  const factura = estado.facturas.find((f) => f.id === facturaId)
  if (!factura || factura.estado !== 'abierta') return { ok: false, error: 'Solo se cancela un documento que todavía está abierto.' }
  factura.estado = 'cancelada'
  return { ok: true, estado, aviso: 'Documento cancelado. No se certificó, así que no hay asiento que revertir.' }
}

export function descartarBorrador(entrada: Estado, facturaId: string): Resultado {
  return cancelarDocumento(entrada, facturaId)
}

export function anularConCertificador(entrada: Estado, facturaId: string, motivo: string): Resultado {
  const estado = clonar(entrada)
  const factura = estado.facturas.find((f) => f.id === facturaId)
  if (!factura || factura.tipo !== 'FACT' || factura.estado !== 'cerrada') {
    return { ok: false, error: 'El servicio de anulación aplica a una factura cerrada.' }
  }
  if (factura.ajustada) return { ok: false, error: 'Esa factura ya fue ajustada.' }
  if (factura.cobros.length > 0) return { ok: false, error: 'La factura tiene cobros. No se puede anular ante el certificador hasta dejar el saldo intacto.' }
  if (notaVigente(estado, factura.id)) return { ok: false, error: 'Ya hay una nota sobre esa factura. Cancelala o certificala antes de anular el documento.' }
  const orden = estado.ordenesVenta.find((o) => o.id === factura.ordenVentaId)
  const serie = estado.series.find((s) => s.id === factura.serieId)
  const referencia = folio(serie?.prefijo ?? 'FAC', factura.numero ?? 0)
  let costo = 0
  if (factura.movioInventario && orden && orden.origenInventario === 'factura') {
    entradaInventario(estado, orden, referencia, 'Devolución por anulación', fechaGT())
    orden.origenInventario = null
    costo = costoOrden(orden)
  }
  const totales = totalesVenta(factura.lineas)
  const socio = estado.socios.find((s) => s.id === factura.socioId)
  const lineas = lineasIngreso(totales.total, totales.iva, socio?.nombre ?? 'Cliente', -1)
  if (costo > 0) {
    lineas.push({ cuentaId: CTA.inventario, detalle: 'Reingreso de inventario', debe: costo, haber: 0 })
    lineas.push({ cuentaId: CTA.costo, detalle: 'Reversión de costo', debe: 0, haber: costo })
  }
  const asiento = registrarAsiento(estado, {
    fecha: fechaGT(),
    descripcion: `Anulación ${referencia}`,
    origen: 'cancelacion',
    origenId: factura.id,
    sucursalId: factura.sucursalId,
    lineas,
  })
  if ('error' in asiento) return { ok: false, error: asiento.error }
  factura.estado = 'cancelada'
  factura.ajustada = true
  factura.motivo = motivo.trim() || 'Anulación ante el certificador'
  factura.asientoId = asiento.id
  return { ok: true, estado, aviso: 'Anulada con el certificador simulado. En producción este paso llama al servicio de anulación.' }
}

function lineasIngreso(total: number, iva: number, detalle: string, signo: 1 | -1): LineaAsiento[] {
  const ingreso = redondear(total - iva)
  if (signo === 1) {
    return [
      { cuentaId: CTA.clientes, detalle, debe: total, haber: 0 },
      { cuentaId: CTA.ventas, detalle: 'Ventas', debe: 0, haber: ingreso },
      { cuentaId: CTA.ivaDebito, detalle: 'IVA débito fiscal', debe: 0, haber: iva },
    ]
  }
  return [
    { cuentaId: CTA.ventas, detalle: 'Reversión de ventas', debe: ingreso, haber: 0 },
    { cuentaId: CTA.ivaDebito, detalle: 'Reversión de IVA débito', debe: iva, haber: 0 },
    { cuentaId: CTA.clientes, detalle, debe: 0, haber: total },
  ]
}

export function aplicarCertificacion(entrada: Estado, facturaId: string, acuse: AcuseFel, dte: DteFel): Resultado {
  const estado = clonar(entrada)
  const factura = estado.facturas.find((f) => f.id === facturaId)
  if (!factura || factura.estado !== 'abierta') return { ok: false, error: 'La factura ya no está abierta.' }
  if (!acuse.resultado) {
    factura.ultimoError = acuse.errores.map((e) => e.mensaje).join(' ') || 'El certificador rechazó el documento.'
    return { ok: false, error: factura.ultimoError, estado }
  }
  const tipoSerie: TipoSerie = factura.tipo === 'NCRE' ? 'NOTA_CREDITO' : factura.tipo === 'NDEB' ? 'NOTA_DEBITO' : 'FACTURA'
  const serie = exigirSerie(estado, factura.sucursalId, tipoSerie)
  if ('error' in serie) return { ok: false, error: serie.error }

  const orden = estado.ordenesVenta.find((o) => o.id === factura.ordenVentaId)
  let costo = 0
  if (factura.tipo === 'FACT' && orden && !orden.origenInventario) {
    const falta = faltaStock(estado, orden.sucursalId, orden.lineas)
    if (falta) return { ok: false, error: falta }
  }

  const numero = tomarNumero(estado, serie.id)
  if ('error' in numero) return { ok: false, error: numero.error }
  const referencia = folio(serie.prefijo, numero.numero)
  const totales = totalesVenta(factura.lineas)
  const socio = estado.socios.find((s) => s.id === factura.socioId)

  if (factura.tipo === 'FACT' && orden && !orden.origenInventario) {
    salidaInventario(estado, orden, referencia, 'Salida por factura de mostrador', factura.fecha)
    orden.origenInventario = 'factura'
    factura.movioInventario = true
    costo = costoOrden(orden)
  }

  if (factura.tipo === 'NCRE') {
    const origen = estado.facturas.find((f) => f.id === factura.facturaOrigenId)
    if (origen?.movioInventario && orden && orden.origenInventario === 'factura') {
      entradaInventario(estado, orden, referencia, 'Devolución por nota de crédito', factura.fecha)
      orden.origenInventario = null
      costo = costoOrden(orden)
      factura.movioInventario = true
    }
    if (origen) origen.ajustada = true
  }

  const lineas = lineasIngreso(totales.total, totales.iva, socio?.nombre ?? 'Cliente', factura.tipo === 'NCRE' ? -1 : 1)
  if (costo > 0 && factura.tipo === 'FACT') {
    lineas.push({ cuentaId: CTA.costo, detalle: 'Costo de ventas', debe: costo, haber: 0 })
    lineas.push({ cuentaId: CTA.inventario, detalle: 'Salida de inventario', debe: 0, haber: costo })
  }
  if (costo > 0 && factura.tipo === 'NCRE') {
    lineas.push({ cuentaId: CTA.inventario, detalle: 'Reingreso de inventario', debe: costo, haber: 0 })
    lineas.push({ cuentaId: CTA.costo, detalle: 'Reversión de costo', debe: 0, haber: costo })
  }
  const nombreDocumento = factura.tipo === 'NCRE' ? 'Nota de crédito' : factura.tipo === 'NDEB' ? 'Nota de débito' : 'Factura'
  const asiento = registrarAsiento(estado, {
    fecha: factura.fecha,
    descripcion: `${nombreDocumento} ${referencia}`,
    origen: factura.tipo === 'NCRE' ? 'nota_credito' : factura.tipo === 'NDEB' ? 'nota_debito' : 'factura',
    origenId: factura.id,
    sucursalId: factura.sucursalId,
    lineas,
  })
  if ('error' in asiento) return { ok: false, error: asiento.error }
  factura.estado = 'cerrada'
  factura.numero = numero.numero
  factura.acuse = acuse
  factura.dte = dte
  factura.asientoId = asiento.id
  factura.ultimoError = undefined
  return {
    ok: true,
    estado,
    id: factura.id,
    aviso: `Certificada. Autorización ${acuse.uuid}`,
  }
}

export function registrarCobro(entrada: Estado, facturaId: string, monto: number, forma: FormaCobro, referencia: string): Resultado {
  const estado = clonar(entrada)
  const factura = estado.facturas.find((f) => f.id === facturaId)
  if (!factura || (factura.tipo !== 'FACT' && factura.tipo !== 'NDEB') || factura.estado !== 'cerrada' || factura.ajustada) {
    return { ok: false, error: 'Solo se cobra una factura o nota de débito cerrada y vigente.' }
  }
  const saldo = redondear(totalesVenta(factura.lineas).total - factura.cobros.reduce((s, c) => s + c.monto, 0))
  if (monto <= 0 || monto - saldo > 0.001) return { ok: false, error: `El cobro no puede pasar el saldo de Q${saldo.toFixed(2)}.` }
  const serie = exigirSerie(estado, factura.sucursalId, 'RECIBO')
  if ('error' in serie) return { ok: false, error: serie.error }
  const numero = tomarNumero(estado, serie.id)
  if ('error' in numero) return { ok: false, error: numero.error }
  const cuenta = forma === 'efectivo' ? CTA.caja : CTA.bancos
  const asiento = registrarAsiento(estado, {
    fecha: fechaGT(),
    descripcion: `Recibo ${folio(serie.prefijo, numero.numero)}`,
    origen: 'cobro',
    origenId: factura.id,
    sucursalId: factura.sucursalId,
    lineas: [
      { cuentaId: cuenta, detalle: forma, debe: redondear(monto), haber: 0 },
      { cuentaId: CTA.clientes, detalle: referencia || 'Cobro de factura', debe: 0, haber: redondear(monto) },
    ],
  })
  if ('error' in asiento) return { ok: false, error: asiento.error }
  factura.cobros.push({
    id: nid('cob'),
    fecha: fechaGT(),
    monto: redondear(monto),
    serieId: serie.id,
    numero: numero.numero,
    forma,
    referencia,
    asientoId: asiento.id,
  })
  return { ok: true, estado, aviso: `Recibo ${folio(serie.prefijo, numero.numero)} registrado` }
}

export interface NuevaRuta {
  sucursalId: string
  repartidorId: string
  vehiculo: string
  ordenIds: string[]
  fecha?: string
}

export function crearRuta(entrada: Estado, input: NuevaRuta): Resultado {
  const estado = clonar(entrada)
  if (input.ordenIds.length === 0) return { ok: false, error: 'Elegí al menos una orden.' }
  const repartidor = estado.usuarios.find((u) => u.id === input.repartidorId && u.activo)
  const rol = estado.roles.find((r) => r.id === repartidor?.rolId)
  if (!repartidor || !rol?.esRepartidor) return { ok: false, error: 'Elegí un usuario repartidor activo.' }
  if (repartidor.sucursalId !== input.sucursalId) return { ok: false, error: 'El repartidor es de otra sucursal.' }
  if (estado.rutas.some((r) => r.repartidorId === repartidor.id && r.estado !== 'finalizada')) {
    return { ok: false, error: 'Ese repartidor ya tiene una ruta abierta.' }
  }
  const paradas = []
  for (const ordenId of input.ordenIds) {
    const orden = estado.ordenesVenta.find((o) => o.id === ordenId)
    if (!orden || orden.sucursalId !== input.sucursalId || orden.estado !== 'confirmada') {
      return { ok: false, error: 'Todas las órdenes tienen que estar confirmadas y ser de la misma sucursal.' }
    }
    if (facturaVigente(estado, orden.id) && orden.origenInventario === 'factura') {
      return { ok: false, error: 'Una orden ya facturada en mostrador no se sube al camión.' }
    }
    const socio = estado.socios.find((s) => s.id === orden.socioId)
    paradas.push({
      id: nid('par'),
      ordenVentaId: orden.id,
      socioId: orden.socioId,
      nombre: socio?.nombre ?? 'Cliente',
      direccion: orden.direccionEntrega,
      telefono: socio?.telefono ?? '',
      lat: orden.lat,
      lng: orden.lng,
      ventana: orden.ventana,
      resumen: orden.lineas.map((l) => `${l.cantidad} ${l.descripcion}`).join(' · '),
      estado: 'pendiente' as const,
      incidencia: '',
    })
    orden.estado = 'en_ruta'
  }
  const codigo = `RT-${String(estado.siguienteRuta).padStart(4, '0')}`
  estado.siguienteRuta += 1
  const ruta = {
    id: nid('ruta'),
    codigo,
    fecha: input.fecha ?? fechaGT(),
    sucursalId: input.sucursalId,
    repartidorId: repartidor.id,
    vehiculo: input.vehiculo.trim() || 'Panel',
    estado: 'planificada' as const,
    paradas,
  }
  estado.rutas.unshift(ruta)
  return { ok: true, estado, id: ruta.id, aviso: `Ruta ${codigo} armada. El camión todavía no ha salido.` }
}

export function iniciarRuta(entrada: Estado, rutaId: string): Resultado {
  const estado = clonar(entrada)
  const ruta = estado.rutas.find((r) => r.id === rutaId)
  if (!ruta || ruta.estado !== 'planificada') return { ok: false, error: 'Esa ruta no está lista para salir.' }
  const ordenes = ruta.paradas
    .map((p) => estado.ordenesVenta.find((o) => o.id === p.ordenVentaId))
    .filter((o): o is OrdenVenta => Boolean(o))
  const pendientes = ordenes.filter((o) => !o.origenInventario)
  const falta = faltaStock(estado, ruta.sucursalId, pendientes.flatMap((o) => o.lineas))
  if (falta) return { ok: false, error: falta }
  const ahora = new Date().toISOString()
  let costo = 0
  for (const orden of pendientes) {
    salidaInventario(estado, orden, ruta.codigo, 'Carga del camión', ruta.fecha)
    orden.origenInventario = 'ruta'
    costo = redondear(costo + costoOrden(orden))
  }
  if (costo > 0) {
    const asiento = registrarAsiento(estado, {
      fecha: ruta.fecha,
      descripcion: `Costo de reparto ${ruta.codigo}`,
      origen: 'despacho',
      origenId: ruta.id,
      sucursalId: ruta.sucursalId,
      lineas: [
        { cuentaId: CTA.costo, detalle: 'Agua cargada al camión', debe: costo, haber: 0 },
        { cuentaId: CTA.inventario, detalle: 'Salida de bodega', debe: 0, haber: costo },
      ],
    })
    if ('error' in asiento) return { ok: false, error: asiento.error }
    ruta.asientoCostoId = asiento.id
  }
  ruta.estado = 'en_curso'
  ruta.iniciadaEn = ahora
  ruta.legStartedAt = ahora
  if (ruta.paradas[0]) ruta.paradas[0].estado = 'en_camino'
  return { ok: true, estado, id: ruta.id, aviso: 'Ruta en curso. El inventario ya salió de bodega.' }
}

export function reportarGps(entrada: Estado, rutaId: string, lat: number, lng: number): Resultado {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: 'La ubicación del teléfono no es válida.' }
  const estado = clonar(entrada)
  const ruta = estado.rutas.find((r) => r.id === rutaId)
  if (!ruta || ruta.estado === 'finalizada') return { ok: false, error: 'Esa ruta ya no recibe ubicación.' }
  ruta.gps = { lat, lng, en: new Date().toISOString() }
  return { ok: true, estado }
}

function cerrarSiTermina(ruta: Estado['rutas'][number]) {
  const abiertas = ruta.paradas.some((p) => p.estado === 'pendiente' || p.estado === 'en_camino' || p.estado === 'llegada')
  if (!abiertas) ruta.estado = 'finalizada'
}

export function marcarParada(entrada: Estado, rutaId: string, paradaId: string, accion: 'llegada' | 'entregada' | 'incidencia', motivo = ''): Resultado {
  const estado = clonar(entrada)
  const ruta = estado.rutas.find((r) => r.id === rutaId)
  if (!ruta || ruta.estado !== 'en_curso') return { ok: false, error: 'La ruta no está en curso.' }
  const parada = ruta.paradas.find((p) => p.id === paradaId)
  const activa = ruta.paradas.find((p) => p.estado === 'en_camino' || p.estado === 'llegada')
  if (!parada || !activa || parada.id !== activa.id) return { ok: false, error: 'Solo se actualiza la parada en curso.' }
  const orden = estado.ordenesVenta.find((o) => o.id === parada.ordenVentaId)
  if (accion === 'llegada') {
    parada.estado = 'llegada'
    return { ok: true, estado, aviso: `Llegada con ${parada.nombre}` }
  }
  if (accion === 'entregada') {
    parada.estado = 'entregada'
    parada.entregadaEn = new Date().toISOString()
    if (orden) orden.estado = 'entregada'
  } else {
    if (!motivo.trim()) return { ok: false, error: 'Indicá el motivo de la incidencia.' }
    parada.estado = 'incidencia'
    parada.incidencia = motivo.trim()
    if (orden?.origenInventario === 'ruta') {
      entradaInventario(estado, orden, ruta.codigo, 'Regreso por incidencia', fechaGT())
      const costo = costoOrden(orden)
      if (costo > 0) {
        const asiento = registrarAsiento(estado, {
          fecha: fechaGT(),
          descripcion: `Devolución a bodega ${ruta.codigo}`,
          origen: 'devolucion_ruta',
          origenId: orden.id,
          sucursalId: ruta.sucursalId,
          lineas: [
            { cuentaId: CTA.inventario, detalle: motivo, debe: costo, haber: 0 },
            { cuentaId: CTA.costo, detalle: 'Reversión de costo de reparto', debe: 0, haber: costo },
          ],
        })
        if ('error' in asiento) return { ok: false, error: asiento.error }
      }
      orden.origenInventario = null
    }
    if (orden) orden.estado = 'confirmada'
  }
  const siguiente = ruta.paradas.find((p) => p.estado === 'pendiente')
  if (siguiente) {
    siguiente.estado = 'en_camino'
    ruta.legStartedAt = new Date().toISOString()
  }
  cerrarSiTermina(ruta)
  return { ok: true, estado, aviso: accion === 'entregada' ? 'Entrega registrada' : 'Incidencia registrada. La orden volvió a confirmarse.' }
}

export interface AsientoManual {
  fecha: string
  sucursalId: string
  descripcion: string
  lineas: LineaAsiento[]
}

export function asientoManual(entrada: Estado, input: AsientoManual): Resultado {
  const estado = clonar(entrada)
  if (input.descripcion.trim().length < 4) return { ok: false, error: 'Describí el asiento.' }
  const asiento = registrarAsiento(estado, {
    fecha: input.fecha || fechaGT(),
    descripcion: input.descripcion.trim(),
    origen: 'manual',
    sucursalId: input.sucursalId,
    lineas: input.lineas,
  })
  if ('error' in asiento) return { ok: false, error: asiento.error }
  return { ok: true, estado, id: asiento.id, aviso: 'Asiento registrado' }
}

function validarIdentidad(razonSocial: string, nombreComercial: string, nit: string): string | null {
  if (razonSocial.trim().length < 4) return 'La razón social es el nombre legal del emisor.'
  if (nombreComercial.trim().length < 2) return 'Indicá el nombre comercial.'
  const limpio = nitLimpio(nit)
  if (!nitValido(limpio) || limpio === 'CF') return 'El NIT del emisor no es válido.'
  return null
}

export function guardarEmpresa(entrada: Estado, empresa: Empresa): Resultado {
  const estado = clonar(entrada)
  const identidad = validarIdentidad(empresa.razonSocial, empresa.nombreComercial, empresa.nit)
  if (identidad) return { ok: false, error: identidad }
  if (empresa.direccion.trim().length < 8) return { ok: false, error: 'La dirección fiscal está incompleta.' }
  if (empresa.telefono.trim().length < 8) return { ok: false, error: 'Indicá un teléfono de la empresa.' }
  if (!empresa.correo.includes('@')) return { ok: false, error: 'El correo de facturación no es válido.' }
  if (!empresa.municipio.trim() || !empresa.departamento.trim()) return { ok: false, error: 'Indicá municipio y departamento.' }
  if (!Number.isFinite(empresa.codigoPostal) || empresa.codigoPostal < 100) return { ok: false, error: 'El código postal no es válido.' }
  estado.empresa = {
    razonSocial: empresa.razonSocial.trim(),
    nombreComercial: empresa.nombreComercial.trim(),
    nit: nitLimpio(empresa.nit),
    correo: empresa.correo.trim(),
    telefono: empresa.telefono.trim(),
    direccion: empresa.direccion.trim(),
    municipio: empresa.municipio.trim(),
    departamento: empresa.departamento.trim(),
    codigoPostal: Math.round(empresa.codigoPostal),
  }
  return { ok: true, estado, aviso: 'Datos de la empresa guardados' }
}

export function guardarDatosFiscales(
  entrada: Estado,
  emisor: { razonSocial: string; nombreComercial: string; nit: string },
  config: ConfigFel,
): Resultado {
  const estado = clonar(entrada)
  const identidad = validarIdentidad(emisor.razonSocial, emisor.nombreComercial, emisor.nit)
  if (identidad) return { ok: false, error: identidad }
  if (config.fraseTipo !== 1) return { ok: false, error: 'Esta versión deja lista la frase de ISR tipo 1, que es la obligatoria en factura.' }
  estado.empresa.razonSocial = emisor.razonSocial.trim()
  estado.empresa.nombreComercial = emisor.nombreComercial.trim()
  estado.empresa.nit = nitLimpio(emisor.nit)
  estado.fel = config
  return { ok: true, estado, aviso: 'Emisor y certificador guardados. El NIT sale en el DTE sin guiones.' }
}

export function actualizarFel(entrada: Estado, config: ConfigFel): Resultado {
  return guardarDatosFiscales(entrada, entrada.empresa, config)
}

export interface VentaPos {
  sucursalId: string
  socioId: string
  vendedorId: string
  lineas: NuevaVenta['lineas']
}

export function registrarVentaPos(entrada: Estado, input: VentaPos): Resultado {
  const sucursal = entrada.sucursales.find((s) => s.id === input.sucursalId && s.activa)
  if (!sucursal) return { ok: false, error: 'Elegí una sucursal activa.' }
  for (const linea of input.lineas) {
    const producto = entrada.productos.find((p) => p.id === linea.productoId && p.activo)
    if (!producto) return { ok: false, error: 'Hay un producto que ya no está activo.' }
    if (producto.controlaInventario && stock(entrada, input.sucursalId, producto.id) + 0.0001 < linea.cantidad) {
      return { ok: false, error: `No hay suficiente ${producto.nombre} en ${sucursal.nombre}.` }
    }
  }
  const venta = crearOrdenVenta(entrada, {
    sucursalId: input.sucursalId,
    socioId: input.socioId,
    vendedorId: input.vendedorId,
    direccionEntrega: sucursal.direccion,
    lat: sucursal.lat,
    lng: sucursal.lng,
    ventana: 'Mostrador',
    notas: 'Punto de venta',
    confirmar: true,
    lineas: input.lineas,
  })
  if (!venta.ok || !venta.estado || !venta.id) return venta.ok ? { ok: false, error: 'No se pudo abrir la venta.' } : venta
  const entrega = entregarEnMostrador(venta.estado, venta.id)
  if (!entrega.ok || !entrega.estado) return entrega.ok ? { ok: false, error: 'No se pudo entregar en mostrador.' } : entrega
  const factura = emitirFactura(entrega.estado, venta.id)
  if (!factura.ok) return factura
  return { ok: true, estado: factura.estado, id: factura.id, aviso: 'Ticket armado. Falta la certificación para cobrar.' }
}
