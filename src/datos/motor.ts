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
  Sector,
  Socio,
  Sucursal,
  TipoSerie,
  Usuario,
  Vehiculo,
} from '../dominio/tipos'
import { cuentasBancariasIniciales, flotaInicial, listasIniciales, sectoresIniciales } from './catalogos'
import { codigoSector, esConsumidorFinal, facturaVigente, saldoBanco, saldoCuenta, serieActiva, stock } from './consultas'

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
  for (const linea of lineas) {
    if (linea.cuentaId === CTA.bancos && !linea.bancoId) return { error: 'La línea de bancos necesita una cuenta bancaria.' }
    if (linea.bancoId && linea.cuentaId !== CTA.bancos) return { error: 'La cuenta bancaria solo se usa en la 1102.' }
    if (linea.bancoId && !estado.cuentasBancarias?.some((cuenta) => cuenta.id === linea.bancoId && cuenta.activa)) return { error: 'La cuenta bancaria no está activa.' }
  }
  const salidas = new Map<string, number>()
  for (const linea of lineas) {
    if (!linea.bancoId) continue
    salidas.set(linea.bancoId, redondear((salidas.get(linea.bancoId) ?? 0) + linea.haber - linea.debe))
  }
  for (const [bancoId, salida] of salidas) {
    if (salida > 0.001 && saldoBanco(estado, bancoId) + 0.001 < salida) {
      const nombre = estado.cuentasBancarias.find((cuenta) => cuenta.id === bancoId)?.nombre ?? 'la cuenta'
      return { error: `No hay saldo en ${nombre}.` }
    }
  }
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

function pendienteDe(linea: { cantidad: number; despachada?: number }): number {
  return redondear(linea.cantidad - (linea.despachada ?? 0))
}

function cargaParada(orden: OrdenVenta, parada: { carga?: { lineaId: string; cantidad: number }[] }) {
  if (parada.carga?.length) {
    return parada.carga.flatMap((item) => {
      const linea = orden.lineas.find((l) => l.id === item.lineaId)
      return linea && item.cantidad > 0 ? [{ linea, cantidad: item.cantidad }] : []
    })
  }
  return orden.lineas.filter((linea) => linea.cantidad > 0).map((linea) => ({ linea, cantidad: linea.cantidad }))
}

function costoCarga(items: { linea: { controlaInventario: boolean; costoUnitario: number }; cantidad: number }[]): number {
  return redondear(items.filter((item) => item.linea.controlaInventario).reduce((s, item) => s + redondear(item.cantidad * item.linea.costoUnitario), 0))
}

function moverCarga(estado: Estado, orden: OrdenVenta, items: { linea: LineaComercial; cantidad: number }[], tipo: 'entrada' | 'salida', referencia: string, concepto: string, fecha: string) {
  for (const item of items) {
    if (!item.linea.controlaInventario || item.cantidad <= 0) continue
    estado.movimientos.push({
      id: nid('mov'),
      fecha,
      sucursalId: orden.sucursalId,
      productoId: item.linea.productoId,
      tipo,
      cantidad: item.cantidad,
      referencia,
      concepto,
    })
  }
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

export function cargarSaldosIniciales(entrada: Estado, cargas: CargaInicial[], bancos: number, bancoId: string): Resultado {
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
  const flota = redondear((estado.vehiculos ?? []).reduce((suma, vehiculo) => suma + vehiculo.valor, 0))
  const banco = estado.cuentasBancarias?.find((cuenta) => cuenta.id === bancoId && cuenta.activa)
  if (!banco) return { ok: false, error: 'La apertura necesita una cuenta bancaria activa.' }
  const asiento = registrarAsiento(estado, {
    fecha: '2026-01-02',
    descripcion: 'Apertura del ejercicio de demostración',
    origen: 'apertura',
    sucursalId: 'suc-z10',
    lineas: [
      { cuentaId: CTA.bancos, detalle: `Saldo en ${banco.nombre}`, debe: bancos, haber: 0, bancoId: banco.id },
      { cuentaId: CTA.inventario, detalle: 'Inventario inicial a costo estándar', debe: valor, haber: 0 },
      ...(flota > 0 ? [{ cuentaId: CTA.flota, detalle: 'Flota a costo de adquisición', debe: flota, haber: 0 }] : []),
      { cuentaId: CTA.capital, detalle: 'Capital', debe: 0, haber: redondear(bancos + valor + flota) },
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
  const listaPrecioId = input.listaPrecioId || undefined
  if (listaPrecioId && !estado.listasPrecio.some((l) => l.id === listaPrecioId)) return { ok: false, error: 'Esa lista de precios no existe.' }
  const sector = input.sectorId ? estado.sectores?.find((item) => item.id === input.sectorId && item.activo) : undefined
  if (input.sectorId && !sector) return { ok: false, error: 'Ese sector no está activo.' }
  if (sector && sector.sucursalId !== input.sucursalId) return { ok: false, error: 'La sucursal del socio tiene que ser la del sector.' }
  if (input.roles.includes('cliente') && !esConsumidorFinal(input.nit) && !sector) return { ok: false, error: 'El cliente necesita el sector de su sucursal.' }
  const socioInput = { ...input, listaPrecioId, sectorId: sector?.id }
  if (input.id) {
    const actual = estado.socios.find((s) => s.id === input.id)
    if (!actual) return { ok: false, error: 'No encontré el socio.' }
    Object.assign(actual, socioInput, { codigo: actual.codigo })
    return { ok: true, estado, id: actual.id, aviso: 'Socio actualizado' }
  }
  const consecutivo = estado.socios.reduce((max, s) => Math.max(max, Number(s.codigo.replace(/\D/g, '')) || 0), 0) + 1
  const socio: Socio = { ...socioInput, id: nid('soc'), codigo: `SN-${String(consecutivo).padStart(4, '0')}` }
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
  const rol = estado.roles.find((r) => r.id === input.rolId)
  if (!rol) return { ok: false, error: 'Elegí un rol.' }
  let sucursalesIds = [...new Set(input.sucursalesIds ?? [])].filter((id) => estado.sucursales.some((s) => s.id === id))
  if (rol.esRepartidor || rol.alcance === 'empresa') {
    const una = sucursalesIds.includes(input.sucursalId) ? input.sucursalId : sucursalesIds[0]
    if (!una) return { ok: false, error: rol.esRepartidor ? 'El repartidor opera una sola sucursal.' : 'Elegí la sede del usuario.' }
    sucursalesIds = [una]
  } else if (sucursalesIds.length === 0) {
    return { ok: false, error: 'Marcá al menos una sucursal.' }
  }
  const sucursalId = sucursalesIds.includes(input.sucursalId) ? input.sucursalId : sucursalesIds[0]
  const usuario = { ...input, correo: input.correo.toLowerCase(), sucursalId, sucursalesIds }
  if (input.id) {
    const actual = estado.usuarios.find((u) => u.id === input.id)
    if (!actual) return { ok: false, error: 'No encontré el usuario.' }
    Object.assign(actual, usuario)
    return { ok: true, estado, id: actual.id, aviso: 'Usuario actualizado' }
  }
  const creado: Usuario = { ...usuario, id: nid('usr') }
  estado.usuarios.push(creado)
  return { ok: true, estado, id: creado.id, aviso: 'Usuario creado' }
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
  facturar?: boolean
  receptorNombre?: string
  sectorId?: string
  listaPrecioId?: string
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
  const sectorId = input.sectorId || socio.sectorId
  const sector = sectorId ? estado.sectores?.find((item) => item.id === sectorId && item.activo) : undefined
  if (!sector) return { ok: false, error: 'Elegí el sector de la venta.' }
  if (sector.sucursalId !== input.sucursalId) return { ok: false, error: 'El sector pertenece a otra sucursal.' }
  const ocasional = esConsumidorFinal(socio.nit)
  const receptorNombre = input.receptorNombre?.trim() ?? ''
  if (ocasional && input.facturar !== false && receptorNombre.length < 3) return { ok: false, error: 'En consumidor final indicá a quién se le vendió.' }
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
    listaPrecioId: estado.listasPrecio.some((l) => l.id === input.listaPrecioId) ? input.listaPrecioId : undefined,
    facturar: input.facturar !== false,
    receptorNombre: receptorNombre || undefined,
    sectorId: sector?.id,
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
  if (orden.facturar === false) return { ok: false, error: 'Esta orden está marcada para no enviarse a facturar.' }
  if (facturaVigente(estado, ordenId)) return { ok: false, error: 'Esa orden ya tiene una factura vigente.' }
  const cliente = estado.socios.find((s) => s.id === orden.socioId)
  if (cliente && esConsumidorFinal(cliente.nit) && (!orden.receptorNombre || !orden.sectorId)) {
    return { ok: false, error: 'En consumidor final hacen falta el nombre de quien compró y el sector.' }
  }
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
    receptorNombre: orden.receptorNombre,
    sectorId: orden.sectorId ?? cliente?.sectorId,
  }
  estado.facturas.unshift(factura)
  return { ok: true, estado, id: factura.id, aviso: 'Factura abierta. Todavía no consume correlativo.' }
}

export function cerrarVentaInterna(entrada: Estado, ordenId: string, fecha?: string): Resultado {
  const estado = clonar(entrada)
  const orden = estado.ordenesVenta.find((o) => o.id === ordenId)
  if (!orden || orden.estado === 'anulada' || orden.estado === 'borrador') {
    return { ok: false, error: 'Confirmá la orden antes de cerrarla.' }
  }
  if (orden.facturar !== false) return { ok: false, error: 'Esta orden sí se envía a facturar.' }
  if (facturaVigente(estado, ordenId)) return { ok: false, error: 'Esa orden ya tiene un documento vigente.' }
  const totales = totalesVenta(orden.lineas)
  if (totales.total <= 0) return { ok: false, error: 'La venta no tiene importe.' }
  const dia = fecha ?? fechaGT()
  let costo = 0
  const porFacturar = !orden.origenInventario
    ? orden.lineas.map((linea) => ({ ...linea, cantidad: Math.max(0, pendienteDe(linea)) })).filter((linea) => linea.cantidad > 0.001)
    : []
  if (porFacturar.length > 0) {
    const falta = faltaStock(estado, orden.sucursalId, porFacturar)
    if (falta) return { ok: false, error: falta }
  }
  estado.siguienteInterno = estado.siguienteInterno ?? 1
  const numero = estado.siguienteInterno
  estado.siguienteInterno += 1
  const referencia = folio('CI', numero)
  if (porFacturar.length > 0) {
    const yaDespachada = orden.lineas.some((linea) => (linea.despachada ?? 0) > 0.001)
    moverCarga(estado, orden, porFacturar.map((linea) => ({ linea: orden.lineas.find((l) => l.id === linea.id) ?? linea, cantidad: linea.cantidad })), 'salida', referencia, 'Salida por venta interna', dia)
    if (!yaDespachada) orden.origenInventario = 'factura'
    for (const linea of orden.lineas) {
      if (pendienteDe(linea) > 0.001) linea.despachada = linea.cantidad
    }
    costo = costoCarga(porFacturar.map((linea) => ({ linea, cantidad: linea.cantidad })))
  }
  const socio = estado.socios.find((s) => s.id === orden.socioId)
  const detalle = orden.receptorNombre || socio?.nombre || 'Cliente'
  const lineas = lineasIngreso(totales.total, totales.iva, detalle, 1)
  if (costo > 0) {
    lineas.push({ cuentaId: CTA.costo, detalle: 'Costo de ventas', debe: costo, haber: 0 })
    lineas.push({ cuentaId: CTA.inventario, detalle: 'Salida de inventario', debe: 0, haber: costo })
  }
  const asiento = registrarAsiento(estado, {
    fecha: dia,
    descripcion: `Venta interna ${referencia}`,
    origen: 'factura',
    sucursalId: orden.sucursalId,
    lineas,
  })
  if ('error' in asiento) return { ok: false, error: asiento.error }
  const serie = estado.series.find((item) => item.sucursalId === orden.sucursalId && item.tipo === 'FACTURA')
  const factura: Estado['facturas'][number] = {
    id: nid('fac'),
    tipo: 'FACT',
    sucursalId: orden.sucursalId,
    socioId: orden.socioId,
    ordenVentaId: orden.id,
    serieId: serie?.id ?? orden.serieId,
    numero,
    fecha: dia,
    estado: 'cerrada',
    lineas: structuredClone(orden.lineas),
    motivo: 'Venta sin certificación FEL',
    acuse: null,
    dte: null,
    cobros: [],
    asientoId: asiento.id,
    movioInventario: porFacturar.some((linea) => linea.controlaInventario),
    ajustada: false,
    interna: true,
    receptorNombre: orden.receptorNombre,
    sectorId: orden.sectorId ?? socio?.sectorId,
  }
  estado.facturas.unshift(factura)
  if (orden.estado === 'confirmada') orden.estado = 'entregada'
  return { ok: true, estado, id: factura.id, aviso: `Venta interna ${referencia} cerrada, sin certificador` }
}

function notaVigente(estado: Estado, facturaId: string) {
  return estado.facturas.some((f) => f.facturaOrigenId === facturaId && f.estado !== 'cancelada')
}

export function emitirNota(entrada: Estado, facturaId: string, tipo: 'NCRE' | 'NDEB', motivo: string): Resultado {
  const estado = clonar(entrada)
  const origen = estado.facturas.find((f) => f.id === facturaId)
  if (origen?.interna) return { ok: false, error: 'La venta interna no pasa por el certificador. No se le emite nota.' }
  if (!origen || origen.tipo !== 'FACT' || origen.estado !== 'cerrada') {
    return { ok: false, error: 'La nota sale de una factura de venta cerrada.' }
  }
  const cliente = estado.socios.find((s) => s.id === origen.socioId)
  if (!origen.ordenVentaId || !cliente?.roles.includes('cliente')) {
    const nombre = tipo === 'NCRE' ? 'crédito' : 'débito'
    return { ok: false, error: `La nota de ${nombre} solo aplica a una factura emitida a un cliente. No se emite sobre una factura de proveedor.` }
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
    motivo: motivo.trim() || (tipo === 'NCRE' ? 'Anulación de la factura' : 'Ajuste a cargo del cliente'),
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
  const porFacturar = orden && factura.tipo === 'FACT' && !orden.origenInventario
    ? orden.lineas.map((linea) => ({ ...linea, cantidad: Math.max(0, pendienteDe(linea)) })).filter((linea) => linea.cantidad > 0.001)
    : []
  if (porFacturar.length > 0 && orden) {
    const falta = faltaStock(estado, orden.sucursalId, porFacturar)
    if (falta) return { ok: false, error: falta }
  }

  const numero = tomarNumero(estado, serie.id)
  if ('error' in numero) return { ok: false, error: numero.error }
  const referencia = folio(serie.prefijo, numero.numero)
  const totales = totalesVenta(factura.lineas)
  const socio = estado.socios.find((s) => s.id === factura.socioId)

  if (porFacturar.length > 0 && orden) {
    const yaDespachada = orden.lineas.some((linea) => (linea.despachada ?? 0) > 0.001)
    moverCarga(estado, orden, porFacturar.map((linea) => ({ linea: orden.lineas.find((l) => l.id === linea.id) ?? linea, cantidad: linea.cantidad })), 'salida', referencia, 'Salida por factura de mostrador', factura.fecha)
    if (!yaDespachada) orden.origenInventario = 'factura'
    for (const linea of orden.lineas) {
      if (pendienteDe(linea) > 0.001) linea.despachada = linea.cantidad
    }
    factura.movioInventario = porFacturar.some((linea) => linea.controlaInventario)
    costo = costoCarga(porFacturar.map((linea) => ({ linea, cantidad: linea.cantidad })))
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

export function registrarCobro(entrada: Estado, facturaId: string, monto: number, forma: FormaCobro, referencia: string, bancoId?: string): Resultado {
  const estado = clonar(entrada)
  const factura = estado.facturas.find((f) => f.id === facturaId)
  if (!factura || (factura.tipo !== 'FACT' && factura.tipo !== 'NDEB') || factura.estado !== 'cerrada' || factura.ajustada) {
    return { ok: false, error: 'Solo se cobra una factura o nota de débito cerrada y vigente.' }
  }
  if (estado.facturas.some((f) => f.facturaOrigenId === factura.id && f.tipo === 'NCRE' && f.estado !== 'cancelada')) {
    return { ok: false, error: 'Hay una nota de crédito sobre esa factura. Certificala o cancelala antes de cobrar.' }
  }
  const saldo = redondear(totalesVenta(factura.lineas).total - factura.cobros.reduce((s, c) => s + c.monto, 0))
  if (monto <= 0 || monto - saldo > 0.001) return { ok: false, error: `El cobro no puede pasar el saldo de Q${saldo.toFixed(2)}.` }
  const serie = exigirSerie(estado, factura.sucursalId, 'RECIBO')
  if ('error' in serie) return { ok: false, error: serie.error }
  const numero = tomarNumero(estado, serie.id)
  if ('error' in numero) return { ok: false, error: numero.error }
  const banco = forma === 'efectivo' ? undefined : estado.cuentasBancarias?.find((item) => item.id === bancoId && item.activa)
  if (forma !== 'efectivo' && !banco) return { ok: false, error: 'Elegí la cuenta bancaria del cobro.' }
  const cuenta = forma === 'efectivo' ? CTA.caja : CTA.bancos
  const asiento = registrarAsiento(estado, {
    fecha: fechaGT(),
    descripcion: `Recibo ${folio(serie.prefijo, numero.numero)}`,
    origen: 'cobro',
    origenId: factura.id,
    sucursalId: factura.sucursalId,
    lineas: [
      { cuentaId: cuenta, detalle: banco ? `${forma} · ${banco.nombre}` : forma, debe: redondear(monto), haber: 0, bancoId: banco?.id },
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
    bancoId: banco?.id,
    asientoId: asiento.id,
  })
  return { ok: true, estado, aviso: `Recibo ${folio(serie.prefijo, numero.numero)} registrado` }
}

export function pagarProveedor(entrada: Estado, ordenId: string, monto: number, forma: FormaCobro, bancoId: string, referencia: string, fecha?: string, facturaProveedor?: string): Resultado {
  const estado = clonar(entrada)
  const orden = estado.ordenesCompra.find((item) => item.id === ordenId)
  if (!orden || orden.estado !== 'recibida') return { ok: false, error: 'Solo se paga una compra ya recibida.' }
  const pagado = (estado.pagosProveedor ?? []).filter((pago) => pago.ordenCompraId === orden.id).reduce((suma, pago) => suma + pago.monto, 0)
  const saldo = redondear(totalesCompra(orden.lineas).total - pagado)
  const importe = redondear(monto)
  if (importe <= 0 || importe - saldo > 0.001) return { ok: false, error: `El pago no puede pasar el saldo de Q${saldo.toFixed(2)}.` }
  const boleta = referencia.trim()
  if (forma !== 'efectivo' && boleta.length < 3) return { ok: false, error: forma === 'tarjeta' ? 'Indicá la autorización de la tarjeta.' : 'Indicá el número de transferencia.' }
  const banco = forma === 'efectivo' ? undefined : estado.cuentasBancarias?.find((item) => item.id === bancoId && item.activa)
  if (forma !== 'efectivo' && !banco) return { ok: false, error: 'Elegí la cuenta bancaria del pago.' }
  const documento = facturaProveedor?.trim() ?? ''
  if (documento && documento.length < 3) return { ok: false, error: 'El número de factura del proveedor es muy corto.' }
  if (documento) orden.facturaProveedor = documento
  const serie = estado.series.find((item) => item.id === orden.serieId)
  const detalle = boleta || 'Efectivo'
  const asiento = registrarAsiento(estado, {
    fecha: fecha || fechaGT(),
    descripcion: `Pago ${folio(serie?.prefijo ?? 'OC', orden.numero)}`,
    origen: 'pago',
    origenId: orden.id,
    sucursalId: orden.sucursalId,
    lineas: [
      { cuentaId: CTA.proveedores, detalle: orden.facturaProveedor ? `${detalle} · factura ${orden.facturaProveedor}` : detalle, debe: importe, haber: 0 },
      { cuentaId: forma === 'efectivo' ? CTA.caja : CTA.bancos, detalle: banco ? `${forma} · ${banco.nombre}` : 'Efectivo', debe: 0, haber: importe, bancoId: banco?.id },
    ],
  })
  if ('error' in asiento) return { ok: false, error: asiento.error }
  if (!estado.pagosProveedor) estado.pagosProveedor = []
  estado.pagosProveedor.push({
    id: nid('pag'),
    fecha: fecha || fechaGT(),
    sucursalId: orden.sucursalId,
    socioId: orden.socioId,
    ordenCompraId: orden.id,
    forma,
    bancoId: banco?.id,
    monto: importe,
    referencia: detalle,
    facturaProveedor: orden.facturaProveedor,
    asientoId: asiento.id,
  })
  return { ok: true, estado, aviso: saldo - importe < 0.01 ? 'Compra pagada' : 'Pago registrado. Queda saldo con el proveedor.' }
}

export function guardarCuentaBancaria(entrada: Estado, input: { id?: string; banco: string; nombre: string; numero: string; sucursalId: string; activa: boolean }): Resultado {
  const estado = clonar(entrada)
  const banco = input.banco.trim()
  const nombre = input.nombre.trim()
  const numero = input.numero.trim().replace(/\s+/g, '')
  if (banco.length < 3) return { ok: false, error: 'Indicá el banco.' }
  if (nombre.length < 3) return { ok: false, error: 'La cuenta necesita un nombre.' }
  if (numero.length < 5) return { ok: false, error: 'El número de cuenta es muy corto.' }
  if (!estado.sucursales.some((sucursal) => sucursal.id === input.sucursalId)) return { ok: false, error: 'Elegí la sucursal que opera la cuenta.' }
  if (!estado.cuentasBancarias) estado.cuentasBancarias = []
  if (estado.cuentasBancarias.some((cuenta) => cuenta.numero === numero && cuenta.id !== input.id)) return { ok: false, error: 'Ese número de cuenta ya está registrado.' }
  if (input.id) {
    const actual = estado.cuentasBancarias.find((cuenta) => cuenta.id === input.id)
    if (!actual) return { ok: false, error: 'No encontré la cuenta bancaria.' }
    actual.banco = banco
    actual.nombre = nombre
    actual.numero = numero
    actual.sucursalId = input.sucursalId
    actual.activa = input.activa
    return { ok: true, estado, id: actual.id, aviso: 'Cuenta bancaria actualizada' }
  }
  const creada = { id: nid('ban'), banco, nombre, numero, moneda: 'GTQ' as const, cuentaId: CTA.bancos, sucursalId: input.sucursalId, activa: input.activa }
  estado.cuentasBancarias.push(creada)
  return { ok: true, estado, id: creada.id, aviso: 'Cuenta bancaria creada' }
}

export interface NuevaRuta {
  sucursalId: string
  sectorId?: string
  repartidorId: string
  vehiculoId?: string
  vehiculo?: string
  ordenIds: string[]
  cargas?: { ordenId: string; lineas: { lineaId: string; cantidad: number }[] }[]
  extras?: { productoId: string; cantidad: number }[]
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
  const textoVehiculo = input.vehiculo?.trim() ?? ''
  const vehiculo = estado.vehiculos.find((v) => v.id === input.vehiculoId)
    ?? estado.vehiculos.find((v) => v.nombre === textoVehiculo || `${v.nombre} · ${v.placa}` === textoVehiculo)
  if (estado.vehiculos.length > 0 && !vehiculo) return { ok: false, error: 'Elegí un vehículo del catálogo de activos.' }
  if (vehiculo && vehiculo.sucursalId !== input.sucursalId) return { ok: false, error: 'Ese vehículo pertenece a otra sucursal.' }
  if (vehiculo && vehiculo.estado !== 'disponible') return { ok: false, error: 'Ese vehículo no está disponible.' }
  const sector = input.sectorId ? estado.sectores?.find((item) => item.id === input.sectorId && item.activo) : undefined
  if (!sector || sector.sucursalId !== input.sucursalId) return { ok: false, error: 'Elegí el sector de esta sucursal.' }
  const extras = []
  for (const extra of input.extras ?? []) {
    const producto = estado.productos.find((p) => p.id === extra.productoId && p.activo && p.controlaInventario)
    if (!producto) return { ok: false, error: 'El extra del camión tiene que ser un producto de inventario.' }
    if (extra.cantidad <= 0) continue
    extras.push({ productoId: producto.id, cantidad: extra.cantidad, vendida: 0, devuelta: 0, costoUnitario: producto.costo })
  }
  const paradas = []
  for (const ordenId of input.ordenIds) {
    const orden = estado.ordenesVenta.find((o) => o.id === ordenId)
    if (!orden || orden.sucursalId !== input.sucursalId || orden.estado !== 'confirmada') {
      return { ok: false, error: 'Todas las órdenes tienen que estar confirmadas y ser de la misma sucursal.' }
    }
    const socioSector = estado.socios.find((s) => s.id === orden.socioId)
    const sectorOrden = orden.sectorId || socioSector?.sectorId
    if (sectorOrden !== sector.id) return { ok: false, error: sectorOrden ? 'La orden es de otro sector.' : 'La orden no tiene sector. Asignalo antes de subirla al camión.' }
    if (facturaVigente(estado, orden.id) && orden.origenInventario === 'factura') {
      return { ok: false, error: 'Una orden ya facturada en mostrador no se sube al camión.' }
    }
    const pedida = input.cargas?.find((carga) => carga.ordenId === orden.id)
    const carga: { lineaId: string; cantidad: number }[] = []
    for (const linea of orden.lineas) {
      const elegida = pedida?.lineas.find((item) => item.lineaId === linea.id)
      const cantidad = elegida ? elegida.cantidad : pendienteDe(linea)
      if (cantidad <= 0) continue
      if (cantidad - pendienteDe(linea) > 0.001) {
        return { ok: false, error: `De ${linea.descripcion} solo quedan ${pendienteDe(linea)} por despachar.` }
      }
      carga.push({ lineaId: linea.id, cantidad })
      linea.despachada = redondear((linea.despachada ?? 0) + cantidad)
    }
    if (carga.length === 0) return { ok: false, error: 'Indicá la cantidad que sube al camión.' }
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
      resumen: carga.map((item) => {
        const linea = orden.lineas.find((l) => l.id === item.lineaId)
        return `${item.cantidad} ${linea?.descripcion ?? ''}`.trim()
      }).join(' · '),
      carga,
      estado: 'pendiente' as const,
      incidencia: '',
    })
    const cubierta = orden.lineas.every((linea) => pendienteDe(linea) <= 0.001)
    if (cubierta) orden.estado = 'en_ruta'
  }
  const codigo = `RT-${String(estado.siguienteRuta).padStart(4, '0')}`
  estado.siguienteRuta += 1
  const ruta = {
    id: nid('ruta'),
    codigo,
    fecha: input.fecha ?? fechaGT(),
    sucursalId: input.sucursalId,
    sectorId: sector.id,
    repartidorId: repartidor.id,
    vehiculoId: vehiculo?.id,
    vehiculo: vehiculo ? `${vehiculo.nombre} · ${vehiculo.placa}` : (textoVehiculo || 'Panel'),
    estado: 'planificada' as const,
    paradas,
    extras,
  }
  if (vehiculo) vehiculo.estado = 'en_ruta'
  estado.rutas.unshift(ruta)
  return { ok: true, estado, id: ruta.id, aviso: `Ruta ${codigo} armada. El camión todavía no ha salido.` }
}

export function iniciarRuta(entrada: Estado, rutaId: string): Resultado {
  const estado = clonar(entrada)
  const ruta = estado.rutas.find((r) => r.id === rutaId)
  if (!ruta || ruta.estado !== 'planificada') return { ok: false, error: 'Esa ruta no está lista para salir.' }
  const cargas = ruta.paradas.flatMap((parada) => {
    const orden = estado.ordenesVenta.find((o) => o.id === parada.ordenVentaId)
    if (!orden || orden.origenInventario === 'factura') return []
    return cargaParada(orden, parada).map((item) => ({ orden, ...item }))
  })
  const extras = ruta.extras ?? []
  const falta = faltaStock(estado, ruta.sucursalId, [
    ...cargas.map((item) => ({ ...item.linea, cantidad: item.cantidad })),
    ...extras.map((extra) => ({
      productoId: extra.productoId,
      cantidad: extra.cantidad,
      controlaInventario: true,
      descripcion: estado.productos.find((p) => p.id === extra.productoId)?.nombre ?? 'Extra',
    })),
  ])
  if (falta) return { ok: false, error: falta }
  const ahora = new Date().toISOString()
  let costo = 0
  const porOrden = new Map<string, typeof cargas>()
  for (const item of cargas) {
    const lista = porOrden.get(item.orden.id) ?? []
    lista.push(item)
    porOrden.set(item.orden.id, lista)
  }
  for (const [ordenId, items] of porOrden) {
    const orden = estado.ordenesVenta.find((o) => o.id === ordenId)
    if (!orden) continue
    moverCarga(estado, orden, items, 'salida', ruta.codigo, 'Carga del camión', ruta.fecha)
    if (orden.lineas.every((linea) => pendienteDe(linea) <= 0.001)) orden.origenInventario = 'ruta'
    costo = redondear(costo + costoCarga(items))
  }
  for (const extra of extras) {
    if (extra.cantidad <= 0) continue
    estado.movimientos.push({
      id: nid('mov'),
      fecha: ruta.fecha,
      sucursalId: ruta.sucursalId,
      productoId: extra.productoId,
      tipo: 'salida',
      cantidad: extra.cantidad,
      referencia: ruta.codigo,
      concepto: 'Extra cargado al camión',
    })
    costo = redondear(costo + redondear(extra.cantidad * extra.costoUnitario))
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

function pendienteExtra(extra: { cantidad: number; vendida: number; devuelta: number }) {
  return redondear(extra.cantidad - extra.vendida - extra.devuelta)
}

function reintegrarPendiente(estado: Estado, ruta: Estado['rutas'][number]): string | null {
  const sobrante = (ruta.extras ?? []).map((extra) => ({ extra, cantidad: pendienteExtra(extra) })).filter((item) => item.cantidad > 0.001)
  if (sobrante.length === 0) return null
  let costo = 0
  for (const item of sobrante) {
    estado.movimientos.push({
      id: nid('mov'),
      fecha: fechaGT(),
      sucursalId: ruta.sucursalId,
      productoId: item.extra.productoId,
      tipo: 'entrada',
      cantidad: item.cantidad,
      referencia: ruta.codigo,
      concepto: 'Reintegro del camión',
    })
    item.extra.devuelta = redondear(item.extra.devuelta + item.cantidad)
    costo = redondear(costo + redondear(item.cantidad * item.extra.costoUnitario))
  }
  if (costo <= 0) return null
  const asiento = registrarAsiento(estado, {
    fecha: fechaGT(),
    descripcion: `Reintegro ${ruta.codigo}`,
    origen: 'devolucion_ruta',
    origenId: ruta.id,
    sucursalId: ruta.sucursalId,
    lineas: [
      { cuentaId: CTA.inventario, detalle: 'Producto que vuelve a bodega', debe: costo, haber: 0 },
      { cuentaId: CTA.costo, detalle: 'Reversión del extra no vendido', debe: 0, haber: costo },
    ],
  })
  return 'error' in asiento ? asiento.error : null
}

function cerrarSiTermina(estado: Estado, ruta: Estado['rutas'][number]): string | null {
  const abiertas = ruta.paradas.some((p) => p.estado === 'pendiente' || p.estado === 'en_camino' || p.estado === 'llegada')
  if (abiertas) return null
  const reintegro = reintegrarPendiente(estado, ruta)
  if (reintegro) return reintegro
  ruta.estado = 'finalizada'
  const vehiculo = estado.vehiculos.find((v) => v.id === ruta.vehiculoId)
  const otra = estado.rutas.some((otraRuta) => otraRuta.id !== ruta.id && otraRuta.vehiculoId === ruta.vehiculoId && otraRuta.estado !== 'finalizada')
  if (vehiculo && vehiculo.estado === 'en_ruta' && !otra) vehiculo.estado = 'disponible'
  return null
}

export function reintegrarExtra(entrada: Estado, rutaId: string): Resultado {
  const estado = clonar(entrada)
  const ruta = estado.rutas.find((r) => r.id === rutaId)
  if (!ruta || ruta.estado === 'planificada') return { ok: false, error: 'El extra se reintegra cuando el camión ya salió.' }
  if (ruta.estado === 'finalizada') return { ok: false, error: 'Esa ruta ya cerró el reintegro.' }
  const error = reintegrarPendiente(estado, ruta)
  if (error) return { ok: false, error }
  const queda = (ruta.extras ?? []).some((extra) => pendienteExtra(extra) > 0.001)
  if (queda) return { ok: false, error: 'Quedó producto sin reintegrar.' }
  return { ok: true, estado, aviso: 'El sobrante volvió a bodega.' }
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
    if (orden) {
      const cubierta = orden.lineas.every((linea) => pendienteDe(linea) <= 0.001)
      const otraAbierta = estado.rutas.some((otra) => otra.estado !== 'finalizada' && otra.paradas.some((p) => p.ordenVentaId === orden.id && p.id !== parada.id && p.estado !== 'entregada' && p.estado !== 'incidencia'))
      orden.estado = cubierta && !otraAbierta ? 'entregada' : 'confirmada'
    }
  } else {
    if (!motivo.trim()) return { ok: false, error: 'Indicá el motivo de la incidencia.' }
    parada.estado = 'incidencia'
    parada.incidencia = motivo.trim()
    if (orden && orden.origenInventario !== 'factura') {
      const items = cargaParada(orden, parada)
      moverCarga(estado, orden, items, 'entrada', ruta.codigo, 'Regreso por incidencia', fechaGT())
      const costo = costoCarga(items)
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
      for (const item of items) item.linea.despachada = Math.max(0, redondear((item.linea.despachada ?? 0) - item.cantidad))
      if (orden.origenInventario === 'ruta') orden.origenInventario = null
    }
    if (orden) orden.estado = 'confirmada'
  }
  const siguiente = ruta.paradas.find((p) => p.estado === 'pendiente')
  if (siguiente) {
    siguiente.estado = 'en_camino'
    ruta.legStartedAt = new Date().toISOString()
  }
  const cierre = cerrarSiTermina(estado, ruta)
  if (cierre) return { ok: false, error: cierre }
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
  rutaId?: string
  receptorNombre?: string
  sectorId?: string
  lineas: NuevaVenta['lineas']
}

export function registrarVentaPos(entrada: Estado, input: VentaPos): Resultado {
  const sucursal = entrada.sucursales.find((s) => s.id === input.sucursalId && s.activa)
  if (!sucursal) return { ok: false, error: 'Elegí una sucursal activa.' }
  const ruta = input.rutaId ? entrada.rutas.find((item) => item.id === input.rutaId) : undefined
  if (input.rutaId && (!ruta || ruta.estado !== 'en_curso' || ruta.sucursalId !== input.sucursalId)) {
    return { ok: false, error: 'Esa ruta no está en curso en esta sucursal.' }
  }
  for (const linea of input.lineas) {
    const producto = entrada.productos.find((p) => p.id === linea.productoId && p.activo)
    if (!producto) return { ok: false, error: 'Hay un producto que ya no está activo.' }
    if (!ruta && producto.controlaInventario && stock(entrada, input.sucursalId, producto.id) + 0.0001 < linea.cantidad) {
      return { ok: false, error: `No hay suficiente ${producto.nombre} en ${sucursal.nombre}.` }
    }
    if (ruta) {
      const extra = ruta.extras?.find((item) => item.productoId === linea.productoId)
      const queda = extra ? pendienteExtra(extra) : 0
      if (queda + 0.0001 < linea.cantidad) return { ok: false, error: `En el camión quedan ${queda} de ${producto.nombre}.` }
    }
  }
  const venta = crearOrdenVenta(entrada, {
    sucursalId: input.sucursalId,
    socioId: input.socioId,
    vendedorId: input.vendedorId,
    direccionEntrega: sucursal.direccion,
    lat: sucursal.lat,
    lng: sucursal.lng,
    ventana: ruta ? 'Ruta' : 'Mostrador',
    notas: ruta ? `Venta en ruta ${ruta.codigo}` : 'Punto de venta',
    confirmar: true,
    facturar: true,
    receptorNombre: input.receptorNombre,
    sectorId: input.sectorId || ruta?.sectorId,
    lineas: input.lineas,
  })
  if (!venta.ok || !venta.estado || !venta.id) return venta.ok ? { ok: false, error: 'No se pudo abrir la venta.' } : venta
  if (ruta) {
    const orden = venta.estado.ordenesVenta.find((item) => item.id === venta.id)
    const rutaVenta = venta.estado.rutas.find((item) => item.id === ruta.id)
    if (orden) {
      orden.origenInventario = 'ruta'
      for (const linea of orden.lineas) linea.despachada = linea.cantidad
    }
    for (const linea of input.lineas) {
      const extra = rutaVenta?.extras?.find((item) => item.productoId === linea.productoId)
      if (extra) extra.vendida = redondear(extra.vendida + linea.cantidad)
    }
  }
  const entrega = entregarEnMostrador(venta.estado, venta.id)
  if (!entrega.ok || !entrega.estado) return entrega.ok ? { ok: false, error: 'No se pudo entregar en mostrador.' } : entrega
  const factura = emitirFactura(entrega.estado, venta.id)
  if (!factura.ok) return factura
  return { ok: true, estado: factura.estado, id: factura.id, aviso: 'Ticket armado. Falta la certificación para cobrar.' }
}

export function guardarVehiculo(entrada: Estado, input: { id?: string; placa: string; nombre: string; sucursalId: string; anio: number; valor: number; estado?: Vehiculo['estado']; bancoId?: string }): Resultado {
  const estado = clonar(entrada)
  const placa = input.placa.trim().toUpperCase()
  const nombre = input.nombre.trim()
  if (placa.length < 5) return { ok: false, error: 'La placa es muy corta.' }
  if (nombre.length < 3) return { ok: false, error: 'El vehículo necesita un nombre.' }
  if (!estado.sucursales.some((s) => s.id === input.sucursalId)) return { ok: false, error: 'Elegí la sucursal del vehículo.' }
  if (input.anio < 1995 || input.anio > 2027) return { ok: false, error: 'El año del vehículo no es válido.' }
  if (estado.vehiculos.some((v) => v.placa === placa && v.id !== input.id)) return { ok: false, error: 'Esa placa ya está en la flota.' }
  if (input.id) {
    const actual = estado.vehiculos.find((v) => v.id === input.id)
    if (!actual) return { ok: false, error: 'No encontré el vehículo.' }
    const ocupado = estado.rutas.some((r) => r.vehiculoId === actual.id && r.estado !== 'finalizada')
    const estadoNuevo = input.estado ?? actual.estado
    if (estadoNuevo === 'en_ruta' && !ocupado) return { ok: false, error: 'En ruta lo asigna el despacho.' }
    if (ocupado && estadoNuevo !== 'en_ruta') return { ok: false, error: 'Ese vehículo tiene una ruta abierta.' }
    if (input.sucursalId !== actual.sucursalId && ocupado) return { ok: false, error: 'No se cambia de sucursal mientras tiene ruta.' }
    actual.placa = placa
    actual.nombre = nombre
    actual.sucursalId = input.sucursalId
    actual.anio = input.anio
    actual.estado = ocupado ? 'en_ruta' : estadoNuevo
    const ruta = estado.rutas.find((r) => r.vehiculoId === actual.id && r.estado !== 'finalizada')
    if (ruta) ruta.vehiculo = `${actual.nombre} · ${actual.placa}`
    return { ok: true, estado, id: actual.id, aviso: 'Vehículo actualizado' }
  }
  const valor = redondear(input.valor)
  if (valor < 0) return { ok: false, error: 'El valor de adquisición no puede ser negativo.' }
  const banco = valor > 0 ? estado.cuentasBancarias?.find((cuenta) => cuenta.id === input.bancoId && cuenta.activa) : undefined
  if (valor > 0 && !banco) return { ok: false, error: 'Elegí la cuenta bancaria que paga el vehículo.' }
  const consecutivo = estado.vehiculos.reduce((max, v) => Math.max(max, Number(v.codigo.replace(/\D/g, '')) || 0), 0) + 1
  const creado: Vehiculo = {
    id: nid('veh'),
    codigo: `VEH-${String(consecutivo).padStart(4, '0')}`,
    placa,
    nombre,
    sucursalId: input.sucursalId,
    anio: input.anio,
    valor,
    estado: 'disponible',
  }
  if (valor > 0) {
    const asiento = registrarAsiento(estado, {
      fecha: fechaGT(),
      descripcion: `Alta de activo ${nombre} ${placa}`,
      origen: 'activo',
      sucursalId: input.sucursalId,
      lineas: [
        { cuentaId: CTA.flota, detalle: nombre, debe: valor, haber: 0 },
        { cuentaId: CTA.bancos, detalle: `Pago de la flota · ${banco?.nombre ?? ''}`, debe: 0, haber: valor, bancoId: banco?.id },
      ],
    })
    if ('error' in asiento) return { ok: false, error: asiento.error }
  }
  estado.vehiculos.push(creado)
  return { ok: true, estado, id: creado.id, aviso: `${creado.codigo} quedó en la cuenta 1501` }
}

export function guardarLista(entrada: Estado, input: { id?: string; nombre: string; activa?: boolean }): Resultado {
  const estado = clonar(entrada)
  const nombre = input.nombre.trim()
  if (nombre.length < 3) return { ok: false, error: 'La lista necesita un nombre.' }
  if (input.id) {
    const actual = estado.listasPrecio.find((l) => l.id === input.id)
    if (!actual) return { ok: false, error: 'No encontré la lista.' }
    if (actual.esBase && input.activa === false) return { ok: false, error: 'La lista general se mantiene activa.' }
    actual.nombre = nombre
    if (input.activa !== undefined && !actual.esBase) actual.activa = input.activa
    return { ok: true, estado, id: actual.id, aviso: 'Lista actualizada' }
  }
  const codigo = nombre.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-zA-Z0-9]+/g, '').toUpperCase().slice(0, 12) || 'LISTA'
  if (estado.listasPrecio.some((l) => l.codigo === codigo)) return { ok: false, error: 'Ya hay una lista con ese código.' }
  const lista = { id: nid('lis'), codigo, nombre, activa: true, esBase: false }
  estado.listasPrecio.push(lista)
  const base = estado.listasPrecio.find((l) => l.esBase)
  for (const producto of estado.productos) {
    const referencia = estado.precios.find((p) => p.listaId === base?.id && p.productoId === producto.id)
    estado.precios.push({ id: nid('px'), listaId: lista.id, productoId: producto.id, precio: referencia?.precio ?? producto.precio })
  }
  return { ok: true, estado, id: lista.id, aviso: `Lista ${lista.nombre} creada` }
}

export function guardarPrecios(entrada: Estado, listaId: string, items: { productoId: string; precio: number }[]): Resultado {
  const estado = clonar(entrada)
  const lista = estado.listasPrecio.find((l) => l.id === listaId)
  if (!lista) return { ok: false, error: 'No encontré la lista.' }
  for (const item of items) {
    if (!(item.precio >= 0)) return { ok: false, error: 'El precio no puede ser negativo.' }
    if (!estado.productos.some((p) => p.id === item.productoId)) return { ok: false, error: 'Hay un producto que no existe.' }
    const actual = estado.precios.find((p) => p.listaId === lista.id && p.productoId === item.productoId)
    if (actual) actual.precio = redondear(item.precio)
    else estado.precios.push({ id: nid('px'), listaId: lista.id, productoId: item.productoId, precio: redondear(item.precio) })
  }
  return { ok: true, estado, id: lista.id, aviso: `Precios de ${lista.nombre} guardados` }
}

export function guardarSector(entrada: Estado, input: { id?: string; departamentoCodigo: string; municipioCodigo: string; sector: string; nombre: string; sucursalId: string; activo: boolean }): Resultado {
  const estado = clonar(entrada)
  const departamentoCodigo = input.departamentoCodigo.trim()
  const municipioCodigo = input.municipioCodigo.trim()
  const sector = input.sector.trim()
  const nombre = input.nombre.trim()
  if (!/^\d{2,5}$/.test(departamentoCodigo)) return { ok: false, error: 'El departamento usa de 2 a 5 dígitos. El ejemplo es 02001.' }
  if (!/^\d{1,3}$/.test(municipioCodigo)) return { ok: false, error: 'El municipio usa de 1 a 3 dígitos. El ejemplo es 01.' }
  if (!/^\d{1,2}$/.test(sector)) return { ok: false, error: 'El sector es un número. El ejemplo es 1.' }
  if (nombre.length < 3) return { ok: false, error: 'El sector necesita un nombre.' }
  if (!estado.sucursales.some((item) => item.id === input.sucursalId)) return { ok: false, error: 'Elegí la sucursal del sector.' }
  const codigo = codigoSector(departamentoCodigo, municipioCodigo, sector)
  if (!estado.sectores) estado.sectores = []
  if (estado.sectores.some((item) => item.codigo === codigo && item.id !== input.id)) return { ok: false, error: `El código ${codigo} ya existe.` }
  if (input.id) {
    const actual = estado.sectores.find((item) => item.id === input.id)
    if (!actual) return { ok: false, error: 'No encontré el sector.' }
    actual.departamentoCodigo = departamentoCodigo
    actual.municipioCodigo = municipioCodigo
    actual.sector = sector
    actual.codigo = codigo
    actual.nombre = nombre
    actual.sucursalId = input.sucursalId
    actual.activo = input.activo
    return { ok: true, estado, id: actual.id, aviso: `Sector ${codigo} actualizado` }
  }
  const creado: Sector = { id: nid('sec'), departamentoCodigo, municipioCodigo, sector, codigo, nombre, sucursalId: input.sucursalId, activo: input.activo }
  estado.sectores.push(creado)
  return { ok: true, estado, id: creado.id, aviso: `Sector ${codigo} creado` }
}

export function completarCatalogos(entrada: Estado): Estado {
  const estado = clonar(entrada)
  if (!estado.sectores?.length) estado.sectores = sectoresIniciales()
  const oficial: Record<string, { departamentoCodigo: string; municipioCodigo: string; sector: string }> = {
    'sec-z10-1': { departamentoCodigo: '01', municipioCodigo: '01', sector: '1' },
    'sec-z10-2': { departamentoCodigo: '01', municipioCodigo: '01', sector: '2' },
    'sec-mix-1': { departamentoCodigo: '01', municipioCodigo: '08', sector: '1' },
    'sec-vn-1': { departamentoCodigo: '01', municipioCodigo: '15', sector: '1' },
  }
  for (const sector of estado.sectores) {
    const destino = oficial[sector.id]
    if (!destino || sector.departamentoCodigo.length === 2) continue
    sector.departamentoCodigo = destino.departamentoCodigo
    sector.municipioCodigo = destino.municipioCodigo
    sector.sector = destino.sector
    sector.codigo = codigoSector(destino.departamentoCodigo, destino.municipioCodigo, destino.sector)
  }
  if (!estado.siguienteInterno) estado.siguienteInterno = 1
  if (!estado.cuentasBancarias?.length) estado.cuentasBancarias = cuentasBancariasIniciales()
  if (!estado.pagosProveedor) estado.pagosProveedor = []
  const principal = estado.cuentasBancarias.find((cuenta) => cuenta.id === 'ban-bi') ?? estado.cuentasBancarias[0]
  if (principal) {
    for (const asiento of estado.asientos) {
      for (const linea of asiento.lineas) {
        if (linea.cuentaId === CTA.bancos && !linea.bancoId) linea.bancoId = principal.id
      }
    }
  }
  if (!estado.cuentas.some((c) => c.id === CTA.flota)) {
    const inventario = estado.cuentas.findIndex((c) => c.id === CTA.inventario)
    const cuenta = { id: CTA.flota, codigo: CTA.flota, nombre: 'Activos fijos — flota', tipo: 'activo' as const }
    if (inventario >= 0) estado.cuentas.splice(inventario + 1, 0, cuenta)
    else estado.cuentas.push(cuenta)
  }
  if (!estado.vehiculos?.length) estado.vehiculos = flotaInicial()
  if (!estado.listasPrecio?.length || !estado.precios?.length) {
    const armadas = listasIniciales(estado.productos)
    if (!estado.listasPrecio?.length) estado.listasPrecio = armadas.listas
    if (!estado.precios?.length) estado.precios = armadas.precios
  }
  for (const socio of estado.socios) {
    if (!socio.listaPrecioId) socio.listaPrecioId = socio.id === 'soc-coop' ? 'lista-mayoreo' : 'lista-general'
    if (!socio.sectorId && !esConsumidorFinal(socio.nit)) socio.sectorId = estado.sectores.find((item) => item.sucursalId === socio.sucursalId && item.activo)?.id
  }
  for (const orden of estado.ordenesVenta) {
    if (orden.facturar === undefined) orden.facturar = true
    if (!orden.sectorId) orden.sectorId = estado.socios.find((socio) => socio.id === orden.socioId)?.sectorId
  }
  for (const pago of estado.pagosProveedor ?? []) {
    if (!pago.forma) pago.forma = pago.bancoId ? 'transferencia' : 'efectivo'
  }
  for (const ruta of estado.rutas) {
    if (!ruta.extras) ruta.extras = []
    if (!ruta.sectorId) ruta.sectorId = estado.sectores.find((item) => item.sucursalId === ruta.sucursalId && item.activo)?.id
  }
  for (const ruta of estado.rutas) {
    if (ruta.vehiculoId && estado.vehiculos.some((v) => v.id === ruta.vehiculoId)) continue
    const texto = (ruta.vehiculo ?? '').toLowerCase()
    const hallado = estado.vehiculos.find((v) => texto.includes(v.nombre.toLowerCase()) || texto.includes(v.placa.toLowerCase()))
    if (!hallado) continue
    ruta.vehiculoId = hallado.id
    ruta.vehiculo = `${hallado.nombre} · ${hallado.placa}`
  }
  for (const vehiculo of estado.vehiculos) {
    const ocupado = estado.rutas.some((r) => r.vehiculoId === vehiculo.id && r.estado !== 'finalizada')
    if (ocupado && vehiculo.estado !== 'baja' && vehiculo.estado !== 'taller') vehiculo.estado = 'en_ruta'
    if (!ocupado && vehiculo.estado === 'en_ruta') vehiculo.estado = 'disponible'
  }
  const valor = redondear(estado.vehiculos.reduce((suma, vehiculo) => suma + vehiculo.valor, 0))
  if (valor > 0 && saldoCuenta(estado, CTA.flota) === 0) {
    const asiento = registrarAsiento(estado, {
      fecha: '2026-01-02',
      descripcion: 'Reconocimiento de la flota',
      origen: 'activo',
      sucursalId: estado.sucursales.find((s) => s.esMatriz)?.id ?? estado.sucursales[0]?.id ?? 'suc-z10',
      lineas: [
        { cuentaId: CTA.flota, detalle: 'Costo de adquisición de los paneles', debe: valor, haber: 0 },
        { cuentaId: CTA.capital, detalle: 'Aporte de activos fijos', debe: 0, haber: valor },
      ],
    })
    if ('error' in asiento) return entrada
  }
  return estado
}
