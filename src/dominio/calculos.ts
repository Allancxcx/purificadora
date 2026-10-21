export const IVA = 0.12

export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function monto(n: number): string {
  return redondear(n).toFixed(2)
}

export function nid(prefijo: string): string {
  const aleatorio = crypto.randomUUID().slice(0, 8)
  return `${prefijo}-${aleatorio}`
}

export interface TotalesVenta {
  bruto: number
  descuento: number
  gravable: number
  iva: number
  total: number
  costo: number
}

export function totalesVenta(lineas: { cantidad: number; precioUnitario: number; descuento: number; costoUnitario: number; gravable: boolean; controlaInventario?: boolean }[]): TotalesVenta {
  let bruto = 0
  let descuento = 0
  let gravable = 0
  let iva = 0
  let total = 0
  let costo = 0
  for (const linea of lineas) {
    const precio = redondear(linea.cantidad * linea.precioUnitario)
    const desc = redondear(linea.descuento)
    const neto = redondear(precio - desc)
    bruto = redondear(bruto + precio)
    descuento = redondear(descuento + desc)
    total = redondear(total + neto)
    if (linea.gravable) {
      const base = redondear(neto / (1 + IVA))
      const impuesto = redondear(base * IVA)
      gravable = redondear(gravable + base)
      iva = redondear(iva + impuesto)
    }
    if (linea.controlaInventario !== false) {
      costo = redondear(costo + redondear(linea.cantidad * linea.costoUnitario))
    }
  }
  return { bruto, descuento, gravable, iva, total, costo }
}

export function impuestoLinea(precio: number, descuento: number, gravable: boolean) {
  const neto = redondear(precio - descuento)
  if (!gravable) return { montoGravable: neto, montoImpuesto: 0, total: neto }
  const montoGravable = redondear(neto / (1 + IVA))
  const montoImpuesto = redondear(montoGravable * IVA)
  return { montoGravable, montoImpuesto, total: neto }
}

export interface TotalesCompra {
  base: number
  iva: number
  total: number
  baseInventario: number
  baseGasto: number
}

export function totalesCompra(lineas: { cantidad: number; costoUnitario: number; gravable: boolean; controlaInventario: boolean }[]): TotalesCompra {
  let base = 0
  let iva = 0
  let baseInventario = 0
  let baseGasto = 0
  for (const linea of lineas) {
    const neto = redondear(linea.cantidad * linea.costoUnitario)
    const impuesto = linea.gravable ? redondear(neto * IVA) : 0
    base = redondear(base + neto)
    iva = redondear(iva + impuesto)
    if (linea.controlaInventario) baseInventario = redondear(baseInventario + neto)
    else baseGasto = redondear(baseGasto + neto)
  }
  return { base, iva, total: redondear(base + iva), baseInventario, baseGasto }
}

export const CTA = {
  caja: '1101',
  bancos: '1102',
  clientes: '1201',
  ivaCredito: '1202',
  inventario: '1301',
  proveedores: '2101',
  ivaDebito: '2102',
  capital: '3101',
  ventas: '4101',
  costo: '5101',
  distribucion: '6101',
  administracion: '6102',
} as const
