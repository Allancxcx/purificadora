import { CTA, redondear, totalesCompra, totalesVenta } from '../dominio/calculos'
import { nitLimpio } from '../dominio/formato'
import { distanciaKm, interpolar, type Punto } from '../dominio/geo'
import type { Estado, Factura, OrdenVenta, Ruta, SerieDocumento, TipoSerie, Usuario } from '../dominio/tipos'

export function precioLista(estado: Estado, listaId: string | undefined, productoId: string): number {
  const item = listaId ? estado.precios.find((p) => p.listaId === listaId && p.productoId === productoId) : undefined
  if (item) return item.precio
  return estado.productos.find((p) => p.id === productoId)?.precio ?? 0
}

export function listaDelSocio(estado: Estado, socioId: string): string {
  const socio = estado.socios.find((s) => s.id === socioId)
  const asignada = estado.listasPrecio.find((l) => l.id === socio?.listaPrecioId && l.activa)
  if (asignada) return asignada.id
  return estado.listasPrecio.find((l) => l.esBase && l.activa)?.id ?? estado.listasPrecio.find((l) => l.activa)?.id ?? ''
}

export function codigoSector(departamentoCodigo: string, municipioCodigo: string, sector: string): string {
  const departamento = departamentoCodigo.trim()
  const municipio = municipioCodigo.trim()
  const numero = sector.trim()
  if (departamento.length > 2 && numero.length === 1 && municipio.endsWith(numero)) return `${departamento}${municipio}`
  return `${departamento}${municipio}${numero}`
}

export function esConsumidorFinal(nit: string): boolean {
  return nitLimpio(nit) === 'CF'
}

export function sucursalesDe(usuario: Pick<Usuario, 'sucursalId'> & { sucursalesIds?: string[] }): string[] {
  const marcadas = [...new Set((usuario.sucursalesIds ?? []).filter(Boolean))]
  return marcadas.length ? marcadas : (usuario.sucursalId ? [usuario.sucursalId] : [])
}

export function deSucursal<T extends { sucursalId: string }>(lista: T[], sucursalId: string, permitidas?: string[]): T[] {
  const base = permitidas ? lista.filter((item) => permitidas.includes(item.sucursalId)) : lista
  return sucursalId === 'todas' ? base : base.filter((item) => item.sucursalId === sucursalId)
}

export function folio(prefijo: string, numero: number): string {
  return `${prefijo}-${String(numero).padStart(6, '0')}`
}

export function serieActiva(estado: Estado, sucursalId: string, tipo: TipoSerie): SerieDocumento | undefined {
  return estado.series.find((s) => s.sucursalId === sucursalId && s.tipo === tipo && s.activa)
}

export function stock(estado: Estado, sucursalId: string, productoId: string): number {
  return redondear(
    estado.movimientos
      .filter((m) => m.sucursalId === sucursalId && m.productoId === productoId)
      .reduce((suma, m) => suma + (m.tipo === 'entrada' ? m.cantidad : -m.cantidad), 0),
  )
}

export function valorInventario(estado: Estado, sucursalId?: string, permitidas?: string[]): number {
  let total = 0
  const sucursales = sucursalId && sucursalId !== 'todas' ? [sucursalId] : (permitidas ?? estado.sucursales.map((s) => s.id))
  for (const producto of estado.productos) {
    for (const sucursal of sucursales) {
      total = redondear(total + redondear(stock(estado, sucursal, producto.id) * producto.costo))
    }
  }
  return total
}

export function saldoCuenta(estado: Estado, cuentaId: string, sucursalId?: string, permitidas?: string[]): number {
  let debe = 0
  let haber = 0
  for (const asiento of estado.asientos) {
    if (permitidas && !permitidas.includes(asiento.sucursalId)) continue
    if (sucursalId && sucursalId !== 'todas' && asiento.sucursalId !== sucursalId) continue
    for (const linea of asiento.lineas) {
      if (linea.cuentaId !== cuentaId) continue
      debe += linea.debe
      haber += linea.haber
    }
  }
  return redondear(debe - haber)
}

export function bancosActivos(estado: Estado, permitidas: string[]) {
  return estado.cuentasBancarias.filter((cuenta) => cuenta.activa && permitidas.includes(cuenta.sucursalId))
}

export function saldoBanco(estado: Estado, bancoId: string): number {
  let neto = 0
  for (const asiento of estado.asientos) {
    for (const linea of asiento.lineas) {
      if (linea.bancoId !== bancoId || linea.cuentaId !== CTA.bancos) continue
      neto += linea.debe - linea.haber
    }
  }
  return redondear(neto)
}

export function saldoCompra(estado: Estado, ordenId: string): number {
  const orden = estado.ordenesCompra.find((item) => item.id === ordenId)
  if (!orden || orden.estado !== 'recibida') return 0
  const pagado = (estado.pagosProveedor ?? []).filter((pago) => pago.ordenCompraId === ordenId).reduce((suma, pago) => suma + pago.monto, 0)
  return redondear(totalesCompra(orden.lineas).total - pagado)
}

export function saldoFactura(factura: Factura): number {
  if ((factura.tipo !== 'FACT' && factura.tipo !== 'NDEB') || factura.estado !== 'cerrada' || factura.ajustada) return 0
  const cobrado = redondear(factura.cobros.reduce((suma, cobro) => suma + cobro.monto, 0))
  return redondear(totalesVenta(factura.lineas).total - cobrado)
}

export function facturaVigente(estado: Estado, ordenId: string): Factura | undefined {
  return estado.facturas.find((f) => f.ordenVentaId === ordenId && f.tipo === 'FACT' && f.estado !== 'cancelada' && !f.ajustada)
}

export function pendienteLinea(linea: { cantidad: number; despachada?: number }): number {
  return Math.max(0, redondear(linea.cantidad - (linea.despachada ?? 0)))
}

export function ordenDespachable(estado: Estado, orden: OrdenVenta): boolean {
  if (orden.estado !== 'confirmada') return false
  if (!orden.lineas.some((linea) => pendienteLinea(linea) > 0)) return false
  if (facturaVigente(estado, orden.id)) return false
  return true
}

export function posicionRepartidor(ruta: Ruta, bodega: Punto, now: number): Punto {
  if (ruta.gps) {
    const edad = now - Date.parse(ruta.gps.en)
    if (edad >= 0 && edad < 90_000) return { lat: ruta.gps.lat, lng: ruta.gps.lng }
  }
  const ultima = ruta.paradas[ruta.paradas.length - 1]
  if (ruta.estado === 'planificada') return bodega
  if (ruta.estado === 'finalizada') return ultima ? { lat: ultima.lat, lng: ultima.lng } : bodega
  const destino = ruta.paradas.find((p) => p.estado === 'en_camino' || p.estado === 'llegada')
  if (!destino) return ultima ? { lat: ultima.lat, lng: ultima.lng } : bodega
  if (destino.estado === 'llegada') return { lat: destino.lat, lng: destino.lng }
  const indice = ruta.paradas.findIndex((p) => p.id === destino.id)
  const previa = ruta.paradas.slice(0, indice).reverse().find((p) => p.estado === 'entregada' || p.estado === 'incidencia')
  const origen = previa ? { lat: previa.lat, lng: previa.lng } : bodega
  const inicio = Date.parse(ruta.legStartedAt || ruta.iniciadaEn || '')
  const avance = Number.isFinite(inicio) ? Math.min(0.92, Math.max(0, (now - inicio) / 48_000)) : 0.35
  return interpolar(origen, destino, avance)
}

export function kilometrosRuta(ruta: Ruta, bodega: Punto): number {
  let anterior = bodega
  let total = 0
  for (const parada of ruta.paradas) {
    const punto = { lat: parada.lat, lng: parada.lng }
    total += distanciaKm(anterior, punto)
    anterior = punto
  }
  return total
}

export function descuadre(estado: Estado): string | null {
  for (const asiento of estado.asientos) {
    const debe = redondear(asiento.lineas.reduce((s, l) => s + l.debe, 0))
    const haber = redondear(asiento.lineas.reduce((s, l) => s + l.haber, 0))
    if (debe !== haber) return `Asiento ${asiento.numero} descuadrado (${debe} / ${haber})`
  }
  return null
}
