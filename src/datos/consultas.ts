import { redondear, totalesVenta } from '../dominio/calculos'
import { distanciaKm, interpolar, type Punto } from '../dominio/geo'
import type { Estado, Factura, OrdenVenta, Ruta, SerieDocumento, TipoSerie } from '../dominio/tipos'

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

export function valorInventario(estado: Estado, sucursalId?: string): number {
  let total = 0
  for (const producto of estado.productos) {
    const sucursales = sucursalId ? [sucursalId] : estado.sucursales.map((s) => s.id)
    for (const sucursal of sucursales) {
      total = redondear(total + redondear(stock(estado, sucursal, producto.id) * producto.costo))
    }
  }
  return total
}

export function saldoCuenta(estado: Estado, cuentaId: string): number {
  let debe = 0
  let haber = 0
  for (const asiento of estado.asientos) {
    for (const linea of asiento.lineas) {
      if (linea.cuentaId !== cuentaId) continue
      debe += linea.debe
      haber += linea.haber
    }
  }
  return redondear(debe - haber)
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
