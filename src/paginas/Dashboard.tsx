import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useErp } from '../datos/store'
import { deSucursal, folio, saldoFactura, stock } from '../datos/consultas'
import { redondear, totalesCompra, totalesVenta } from '../dominio/calculos'
import { fechaGT, formatoFecha, quetzales } from '../dominio/formato'
import { Badge, Boton, Tabla, Tarjeta } from '../componentes/ui'

const INDICADORES = [
  { id: 'ventas', titulo: 'Ventas del mes' },
  { id: 'cobrar', titulo: 'Por cobrar' },
  { id: 'rutas', titulo: 'Rutas de hoy' },
  { id: 'abiertas', titulo: 'Facturas abiertas' },
]

interface Cubo {
  cantidad: number
  importe: number
  partes: Map<string, { cantidad: number; importe: number }>
}

function tocar(mapa: Map<string, Cubo>, id: string, parteId: string, cantidad: number, importe: number) {
  const cubo = mapa.get(id) ?? { cantidad: 0, importe: 0, partes: new Map() }
  cubo.cantidad = redondear(cubo.cantidad + cantidad)
  cubo.importe = redondear(cubo.importe + importe)
  const parte = cubo.partes.get(parteId) ?? { cantidad: 0, importe: 0 }
  parte.cantidad = redondear(parte.cantidad + cantidad)
  parte.importe = redondear(parte.importe + importe)
  cubo.partes.set(parteId, parte)
  mapa.set(id, cubo)
}

function mayor(cubo: Cubo) {
  return [...cubo.partes.entries()].sort((a, b) => b[1].importe - a[1].importe || b[1].cantidad - a[1].cantidad)[0]
}

function piezas(n: number) {
  const valor = redondear(n)
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(2)
}

function indicadoresGuardados() {
  try {
    const crudo = localStorage.getItem('manantial.tablero')
    const lista = crudo ? JSON.parse(crudo) as string[] : INDICADORES.map((i) => i.id)
    return INDICADORES.map((i) => i.id).filter((id) => lista.includes(id))
  } catch {
    return INDICADORES.map((i) => i.id)
  }
}

export function Dashboard() {
  const { estado, sucursalActiva, permitidas, enVista } = useErp()
  const [visibles, setVisibles] = useState(indicadoresGuardados)
  const [personalizar, setPersonalizar] = useState(false)
  const [sectorId, setSectorId] = useState('')
  const mes = fechaGT().slice(0, 7)
  const general = sucursalActiva === 'todas'
  const vista = general ? 'General' : (estado.sucursales.find((s) => s.id === sucursalActiva)?.nombre ?? 'Sucursal')
  const facturas = deSucursal(estado.facturas, sucursalActiva, permitidas)
  const cerradas = facturas.filter((f) => f.estado === 'cerrada' && f.fecha.startsWith(mes))
  const vendido = cerradas.filter((f) => f.tipo === 'FACT' && !f.ajustada).reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
  const creditos = cerradas.filter((f) => f.tipo === 'NCRE').reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
  const debitos = cerradas.filter((f) => f.tipo === 'NDEB').reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
  const porCobrar = facturas.reduce((s, f) => s + saldoFactura(f), 0)
  const abiertas = facturas.filter((f) => f.estado === 'abierta').length
  const rutas = deSucursal(estado.rutas, sucursalActiva, permitidas).filter((r) => r.fecha === fechaGT())
  const sucursales = estado.sucursales.filter((s) => enVista(s.id))
  const sectores = (estado.sectores ?? []).filter((sector) => sector.activo && enVista(sector.sucursalId))
  const sectorActivo = sectores.find((sector) => sector.id === sectorId) ?? sectores[0]
  function sectorDeFactura(facturaIdSocio: string, propio?: string) {
    return propio || estado.socios.find((socio) => socio.id === facturaIdSocio)?.sectorId || ''
  }
  function neto(lista: typeof facturas) {
    const delMes = lista.filter((f) => f.estado === 'cerrada' && f.fecha.startsWith(mes))
    const venta = delMes.filter((f) => f.tipo === 'FACT' && !f.ajustada).reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
    const notaCredito = delMes.filter((f) => f.tipo === 'NCRE').reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
    const notaDebito = delMes.filter((f) => f.tipo === 'NDEB').reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
    return venta - notaCredito + notaDebito
  }
  const reporte = sectores.map((sector) => {
    const cuentas = estado.socios.filter((socio) => socio.estado === 'activo' && enVista(socio.sucursalId) && socio.sectorId === sector.id)
    const docs = facturas.filter((factura) => sectorDeFactura(factura.socioId, factura.sectorId) === sector.id)
    return {
      sector,
      cuentas,
      clientes: cuentas.filter((socio) => socio.roles.includes('cliente')).length,
      leads: cuentas.filter((socio) => socio.roles.includes('lead')).length,
      ventas: neto(docs),
      cobrar: docs.reduce((s, f) => s + saldoFactura(f), 0),
      rutas: rutas.filter((ruta) => ruta.sectorId === sector.id).length,
    }
  })
  const cartera = sectorActivo ? reporte.find((fila) => fila.sector.id === sectorActivo.id) : undefined
  const fichas = [...(cartera?.cuentas ?? [])].sort((a, b) => {
    const lead = Number(b.roles.includes('lead')) - Number(a.roles.includes('lead'))
    if (lead) return lead
    return a.nombre.localeCompare(b.nombre, 'es')
  })
  const porProducto = new Map<string, Cubo>()
  const porSectorCompra = new Map<string, Cubo>()
  for (const factura of cerradas) {
    if (factura.tipo === 'FACT' && factura.ajustada) continue
    if (factura.tipo !== 'FACT' && factura.tipo !== 'NCRE' && factura.tipo !== 'NDEB') continue
    const signo = factura.tipo === 'NCRE' ? -1 : 1
    const sector = sectorDeFactura(factura.socioId, factura.sectorId) || 'sin-sector'
    for (const linea of factura.lineas) {
      const cantidad = factura.tipo === 'NDEB' ? 0 : signo * linea.cantidad
      const importe = signo * redondear(redondear(linea.cantidad * linea.precioUnitario) - redondear(linea.descuento))
      tocar(porProducto, linea.productoId, sector, cantidad, importe)
      tocar(porSectorCompra, sector, linea.productoId, cantidad, importe)
    }
  }
  const rankProductos = [...porProducto.entries()].filter(([, cubo]) => Math.abs(cubo.importe) > 0.001 || Math.abs(cubo.cantidad) > 0.001).sort((a, b) => b[1].importe - a[1].importe)
  const rankSectores = [...porSectorCompra.entries()].filter(([, cubo]) => Math.abs(cubo.importe) > 0.001 || Math.abs(cubo.cantidad) > 0.001).sort((a, b) => b[1].importe - a[1].importe)
  const topeProducto = rankProductos[0]?.[1].importe ?? 0
  const topeSector = rankSectores[0]?.[1].importe ?? 0
  const comprasMes = deSucursal(estado.ordenesCompra, sucursalActiva, permitidas).filter((orden) => orden.estado === 'recibida' && orden.fecha.startsWith(mes))
  const porProveedor = new Map<string, { cantidad: number; importe: number }>()
  for (const orden of comprasMes) {
    for (const linea of orden.lineas) {
      const actual = porProveedor.get(linea.productoId) ?? { cantidad: 0, importe: 0 }
      actual.cantidad = redondear(actual.cantidad + linea.cantidad)
      actual.importe = redondear(actual.importe + totalesCompra([linea]).total)
      porProveedor.set(linea.productoId, actual)
    }
  }
  const rankCompras = [...porProveedor.entries()].sort((a, b) => b[1].importe - a[1].importe)
  function etiquetaSector(id: string) {
    if (id === 'sin-sector') return 'Sin sector'
    const sector = estado.sectores?.find((item) => item.id === id)
    return sector ? `${sector.codigo} · ${sector.nombre}` : 'Sin sector'
  }
  function etiquetaProducto(id: string) {
    return estado.productos.find((producto) => producto.id === id)?.nombre ?? 'Producto'
  }
  const bajos = estado.productos.filter((p) => p.controlaInventario && p.activo).flatMap((p) => sucursales.map((s) => ({ producto: p, sucursal: s, cantidad: stock(estado, s.id, p.id) })).filter((x) => x.cantidad < p.minimo))
  const valores: Record<string, string> = {
    ventas: quetzales(vendido - creditos + debitos),
    cobrar: quetzales(porCobrar),
    rutas: String(rutas.length),
    abiertas: String(abiertas),
  }

  function alternar(id: string) {
    const siguiente = visibles.includes(id) ? visibles.filter((item) => item !== id) : [...visibles, id]
    setVisibles(siguiente)
    localStorage.setItem('manantial.tablero', JSON.stringify(siguiente))
  }

  return (
    <section className="space-y-3" data-tour="tablero">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d5dde2] pb-3">
        <div>
          <h1 className="text-xl font-semibold text-[#102027]">Tablero</h1>
          <p className="mt-1 text-sm text-[#4d5960]">{general ? 'Vista general. Las sucursales y los sectores cierran con su total.' : `Vista ${vista}. Indicadores, sectores y documentos son de esta sucursal.`} Elegí un sector para ver su cartera. Más abajo está qué producto y qué sector compran más este mes.</p>
        </div>
        <Boton variante="secundario" onClick={() => setPersonalizar((v) => !v)}>{personalizar ? 'Listo' : 'Personalizar'}</Boton>
      </div>
      {personalizar && (
        <Tarjeta className="flex flex-wrap gap-3">
          {INDICADORES.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={visibles.includes(item.id)} onChange={() => alternar(item.id)} />
              {item.titulo}
            </label>
          ))}
        </Tarjeta>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {INDICADORES.filter((item) => visibles.includes(item.id)).map((item) => (
          <Tarjeta key={item.id}>
            <div className="text-xs font-semibold text-[#5c6770]">{item.titulo}</div>
            <div className="mt-1 text-2xl font-semibold text-[#102027]">{valores[item.id]}</div>
          </Tarjeta>
        ))}
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#102027]">Cartera por sector</h2>
            <p className="text-sm text-[#4d5960]">Cada columna es un sector. Adentro están los clientes y los leads, con la venta del mes y lo que todavía deben.</p>
          </div>
        </div>
        {reporte.length === 0 ? <Tarjeta><p className="text-sm text-[#5c6770]">Esta vista no tiene sectores activos.</p></Tarjeta> : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {reporte.map((fila) => {
              const activa = fila.sector.id === sectorActivo?.id
              return (
                <button key={fila.sector.id} type="button" onClick={() => setSectorId(fila.sector.id)} className={`min-w-[220px] flex-1 rounded-md border bg-white p-3 text-left ${activa ? 'border-[#0b3a4a] ring-2 ring-[#0b3a4a]' : 'border-[#d5dde2]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold tracking-wide text-[#5c6770]">{fila.sector.codigo}</div>
                      <div className="font-semibold text-[#102027]">{fila.sector.nombre}</div>
                    </div>
                    <Badge tono="agua">{estado.sucursales.find((s) => s.id === fila.sector.sucursalId)?.codigo}</Badge>
                  </div>
                  <div className="mt-3 text-xl font-semibold text-[#102027]">{quetzales(fila.ventas)}</div>
                  <div className="text-xs text-[#5c6770]">Ventas del mes</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge tono="ok">{fila.clientes} clientes</Badge>
                    <Badge tono="alerta">{fila.leads} {fila.leads === 1 ? 'lead' : 'leads'}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-[#5c6770]">Por cobrar {quetzales(fila.cobrar)} · {fila.rutas} rutas hoy</div>
                </button>
              )
            })}
          </div>
        )}
        {cartera && (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {fichas.map((socio) => {
              const docs = facturas.filter((factura) => factura.socioId === socio.id && factura.estado === 'cerrada')
              const ultima = [...docs].sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
              const saldo = facturas.filter((factura) => factura.socioId === socio.id).reduce((s, f) => s + saldoFactura(f), 0)
              return (
                <Tarjeta key={socio.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[#102027]">{socio.nombreComercial || socio.nombre}</div>
                      <div className="truncate text-xs text-[#5c6770]">{socio.nombreComercial ? socio.nombre : socio.nit}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">{socio.roles.map((rol) => <Badge key={rol} tono={rol === 'lead' ? 'alerta' : rol === 'proveedor' ? 'agua' : 'ok'}>{rol}</Badge>)}</div>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[#4d5960]">
                    <div>{socio.telefono || 'Sin teléfono'} · {socio.diasCredito ? `${socio.diasCredito} días de crédito` : 'Contado'}</div>
                    <div>Última venta {ultima ? formatoFecha(ultima.fecha) : 'sin documento'} · Saldo {quetzales(saldo)}</div>
                  </div>
                </Tarjeta>
              )
            })}
          </div>
        )}
        <Tabla
          id="tablero-sectores"
          columnas={['Código', 'Sector', 'Sucursal', 'Clientes', 'Leads', 'Ventas del mes', 'Por cobrar', 'Rutas de hoy']}
          vacio="No hay sectores en esta vista."
          filas={[
            ...reporte.map((fila) => ({
              id: fila.sector.id,
              onClick: () => setSectorId(fila.sector.id),
              celdas: [
                fila.sector.codigo,
                fila.sector.nombre,
                estado.sucursales.find((s) => s.id === fila.sector.sucursalId)?.codigo ?? '',
                String(fila.clientes),
                String(fila.leads),
                quetzales(fila.ventas),
                quetzales(fila.cobrar),
                String(fila.rutas),
              ],
            })),
            ...(reporte.length > 1 ? [{
              id: 'total-sectores',
              celdas: [
                '',
                'Total de la vista',
                '',
                String(reporte.reduce((s, fila) => s + fila.clientes, 0)),
                String(reporte.reduce((s, fila) => s + fila.leads, 0)),
                quetzales(reporte.reduce((s, fila) => s + fila.ventas, 0)),
                quetzales(reporte.reduce((s, fila) => s + fila.cobrar, 0)),
                String(reporte.reduce((s, fila) => s + fila.rutas, 0)),
              ],
            }] : []),
          ]}
        />
      </div>
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[#102027]">Qué se está comprando</h2>
          <p className="text-sm text-[#4d5960]">Ventas cerradas de este mes en la vista. Arriba, el producto que más sale y el sector que más compra. La nota de crédito resta. La compra a proveedores va al final y es lo que la sucursal recibió.</p>
        </div>
        {rankProductos.length === 0 ? <Tarjeta><p className="text-sm text-[#5c6770]">Este mes no hay ventas cerradas en la vista.</p></Tarjeta> : (
          <div className="grid gap-3 lg:grid-cols-2">
            <Tarjeta>
              <h3 className="text-sm font-semibold text-[#102027]">Producto que más compran</h3>
              <ul className="mt-3 space-y-3">
                {rankProductos.map(([id, cubo]) => {
                  const ancho = topeProducto > 0 ? Math.max(6, Math.round((Math.max(cubo.importe, 0) / topeProducto) * 100)) : 0
                  const lider = mayor(cubo)
                  return (
                    <li key={id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-[#102027]">{etiquetaProducto(id)}</span>
                        <span className="shrink-0 tabular-nums text-[#4d5960]">{piezas(cubo.cantidad)} · {quetzales(cubo.importe)}</span>
                      </div>
                      <div className="mt-1 h-2 rounded bg-[#e6ebef]"><div className="h-2 rounded bg-[#0b3a4a]" style={{ width: `${ancho}%` }} /></div>
                      <div className="mt-1 text-xs text-[#5c6770]">Más en {lider ? etiquetaSector(lider[0]) : 'sin sector'}</div>
                    </li>
                  )
                })}
              </ul>
            </Tarjeta>
            <Tarjeta>
              <h3 className="text-sm font-semibold text-[#102027]">Sector que más compra</h3>
              <ul className="mt-3 space-y-3">
                {rankSectores.map(([id, cubo]) => {
                  const ancho = topeSector > 0 ? Math.max(6, Math.round((Math.max(cubo.importe, 0) / topeSector) * 100)) : 0
                  const lider = mayor(cubo)
                  return (
                    <li key={id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="font-medium text-[#102027]">{etiquetaSector(id)}</span>
                        <span className="shrink-0 tabular-nums text-[#4d5960]">{piezas(cubo.cantidad)} · {quetzales(cubo.importe)}</span>
                      </div>
                      <div className="mt-1 h-2 rounded bg-[#e6ebef]"><div className="h-2 rounded bg-[#0e7490]" style={{ width: `${ancho}%` }} /></div>
                      <div className="mt-1 text-xs text-[#5c6770]">Llevan más {lider ? etiquetaProducto(lider[0]) : '—'}</div>
                    </li>
                  )
                })}
              </ul>
            </Tarjeta>
          </div>
        )}
        <Tabla
          id="tablero-productos"
          columnas={['Producto', 'Cantidad', 'Importe', 'Sector que más compra', 'Importe de ese sector']}
          vacio="Este mes no hay ventas cerradas en la vista."
          filas={rankProductos.map(([id, cubo]) => {
            const lider = mayor(cubo)
            return {
              id,
              celdas: [etiquetaProducto(id), piezas(cubo.cantidad), quetzales(cubo.importe), lider ? etiquetaSector(lider[0]) : '', lider ? quetzales(lider[1].importe) : ''],
            }
          })}
        />
        <Tabla
          id="tablero-sectores-compra"
          columnas={['Sector', 'Cantidad', 'Importe', 'Producto que más llevan', 'Cantidad de ese producto']}
          vacio="Este mes ningún sector tiene ventas cerradas."
          filas={rankSectores.map(([id, cubo]) => {
            const lider = mayor(cubo)
            return {
              id,
              celdas: [etiquetaSector(id), piezas(cubo.cantidad), quetzales(cubo.importe), lider ? etiquetaProducto(lider[0]) : '', lider ? piezas(lider[1].cantidad) : ''],
            }
          })}
        />
        <Tabla
          id="tablero-compras"
          columnas={['Producto recibido', 'Cantidad', 'Total con IVA']}
          vacio="Este mes no hay compras recibidas en la vista."
          filas={rankCompras.map(([id, cubo]) => ({
            id,
            celdas: [etiquetaProducto(id), piezas(cubo.cantidad), quetzales(cubo.importe)],
          }))}
        />
      </div>
      {general && (
        <Tabla
          id="tablero-sucursales"
          columnas={['Sucursal', 'Ventas del mes', 'Por cobrar', 'Rutas de hoy', 'Facturas abiertas']}
          vacio="No hay sucursales."
          filas={[
            ...sucursales.map((sucursal) => {
              const docs = deSucursal(estado.facturas, sucursal.id)
              const delMes = docs.filter((f) => f.estado === 'cerrada' && f.fecha.startsWith(mes))
              const venta = delMes.filter((f) => f.tipo === 'FACT' && !f.ajustada).reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
              const notaCredito = delMes.filter((f) => f.tipo === 'NCRE').reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
              const notaDebito = delMes.filter((f) => f.tipo === 'NDEB').reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
              return {
                id: sucursal.id,
                celdas: [
                  sucursal.nombre,
                  quetzales(venta - notaCredito + notaDebito),
                  quetzales(docs.reduce((s, f) => s + saldoFactura(f), 0)),
                  String(deSucursal(estado.rutas, sucursal.id).filter((r) => r.fecha === fechaGT()).length),
                  String(docs.filter((f) => f.estado === 'abierta').length),
                ],
              }
            }),
            { id: 'general', celdas: ['General', valores.ventas, valores.cobrar, valores.rutas, valores.abiertas] },
          ]}
        />
      )}
      <Tabla
        id="tablero-documentos"
        columnas={[
          { id: 'documento', titulo: 'Documento' },
          ...(general ? [{ id: 'sucursal', titulo: 'Sucursal' }] : []),
          { id: 'tipo', titulo: 'Tipo' },
          { id: 'fecha', titulo: 'Fecha' },
          { id: 'sector', titulo: 'Sector' },
          { id: 'cliente', titulo: 'Cliente' },
          { id: 'estado', titulo: 'Estado' },
          { id: 'total', titulo: 'Total' },
        ]}
        vacio="No hay documentos en esta vista."
        filas={facturas.map((factura) => {
          const serie = estado.series.find((s) => s.id === factura.serieId)
          return {
            id: factura.id,
            celdas: [
              factura.interna ? folio('CI', factura.numero ?? 0) : factura.numero ? folio(serie?.prefijo ?? 'FAC', factura.numero) : 'Sin número',
              ...(general ? [estado.sucursales.find((s) => s.id === factura.sucursalId)?.codigo ?? ''] : []),
              factura.interna ? 'Venta interna' : factura.tipo === 'NCRE' ? 'Nota de crédito' : factura.tipo === 'NDEB' ? 'Nota de débito' : 'Factura',
              formatoFecha(factura.fecha),
              estado.sectores?.find((sector) => sector.id === sectorDeFactura(factura.socioId, factura.sectorId))?.codigo ?? '',
              factura.receptorNombre || estado.socios.find((s) => s.id === factura.socioId)?.nombre,
              <Badge key="e" tono={factura.estado === 'cerrada' ? 'ok' : factura.estado === 'cancelada' ? 'peligro' : 'alerta'}>{factura.estado}</Badge>,
              quetzales(totalesVenta(factura.lineas).total),
            ],
          }
        })}
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <Tarjeta>
          <h2 className="text-base font-semibold">Rutas de hoy</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {rutas.map((ruta) => {
              const repartidor = estado.usuarios.find((u) => u.id === ruta.repartidorId)
              const hechas = ruta.paradas.filter((p) => p.estado === 'entregada').length
              return (
                <li key={ruta.id} className="border border-[#e6ebef] px-3 py-2">
                  <div className="font-medium">{ruta.codigo} · {repartidor?.nombre}</div>
                  <div className="text-[#5c6770]">{ruta.estado.replaceAll('_', ' ')} · {hechas}/{ruta.paradas.length} entregas · {ruta.vehiculo}</div>
                </li>
              )
            })}
          </ul>
        </Tarjeta>
        <Tarjeta>
          <h2 className="text-base font-semibold">Existencia bajo el mínimo</h2>
          {bajos.length === 0 ? <p className="mt-2 text-sm text-[#5c6770]">Las sucursales visibles están sobre el mínimo.</p> : (
            <ul className="mt-2 space-y-2 text-sm">
              {bajos.slice(0, 6).map((b) => (
                <li key={b.producto.id + b.sucursal.id}>{b.producto.nombre} · {b.sucursal.codigo}: {b.cantidad} (mínimo {b.producto.minimo})</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-[#5c6770]">Para ver el reparto en vivo, dejá esta sesión y abrí otra con el repartidor. <Link className="font-semibold text-[#0b3a4a]" to="/rutas">Ir al mapa</Link></p>
        </Tarjeta>
      </div>
    </section>
  )
}
