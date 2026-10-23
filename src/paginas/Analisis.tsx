import { useErp } from '../datos/store'
import { folio, saldoFactura } from '../datos/consultas'
import { totalesVenta } from '../dominio/calculos'
import { formatoFecha, quetzales } from '../dominio/formato'
import { Pagina, Tabla, Tarjeta } from '../componentes/ui'

export function Analisis() {
  const { estado, sucursalActiva, enVista } = useErp()
  const general = sucursalActiva === 'todas'
  const documentos = estado.facturas.filter((factura) => factura.tipo === 'FACT' && factura.estado === 'cerrada' && !factura.ajustada && enVista(factura.sucursalId))
  const filas = documentos.map((factura) => {
    const socio = estado.socios.find((s) => s.id === factura.socioId)
    const sector = estado.sectores?.find((item) => item.id === (factura.sectorId || socio?.sectorId))
    const serie = estado.series.find((s) => s.id === factura.serieId)
    const cobrado = factura.cobros.reduce((suma, cobro) => suma + cobro.monto, 0)
    const total = totalesVenta(factura.lineas).total
    return {
      id: factura.id,
      fecha: formatoFecha(factura.fecha),
      sucursal: estado.sucursales.find((s) => s.id === factura.sucursalId)?.codigo ?? '',
      sector: sector ? `${sector.codigo} ${sector.nombre}` : 'Sin sector',
      cliente: factura.receptorNombre || socio?.nombre || '',
      documento: factura.interna ? folio('CI', factura.numero ?? 0) : (factura.numero ? folio(serie?.prefijo ?? 'FAC', factura.numero) : 'Sin número'),
      total,
      cobrado,
      saldo: saldoFactura(factura),
    }
  })
  const venta = filas.reduce((suma, fila) => suma + fila.total, 0)
  const cxc = filas.reduce((suma, fila) => suma + fila.saldo, 0)
  const columnas = ['Fecha', ...(general ? ['Sucursal'] : []), 'Sector', 'Cliente', 'Documento', 'Total', 'Cobrado', 'Saldo']

  function celdas(fila: (typeof filas)[number]) {
    return [
      fila.fecha,
      ...(general ? [fila.sucursal] : []),
      fila.sector,
      fila.cliente,
      fila.documento,
      quetzales(fila.total),
      quetzales(fila.cobrado),
      quetzales(fila.saldo),
    ]
  }

  return (
    <Pagina titulo="Análisis de ventas" detalle="Junta las facturas cerradas y las ventas internas de esta vista. La cuenta por cobrar es el saldo que todavía no se cobró.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tarjeta><div className="text-xs uppercase tracking-wide text-slate-500">Ventas cerradas</div><div className="mt-1 text-2xl font-semibold">{quetzales(venta)}</div></Tarjeta>
        <Tarjeta><div className="text-xs uppercase tracking-wide text-slate-500">Por cobrar</div><div className="mt-1 text-2xl font-semibold">{quetzales(cxc)}</div></Tarjeta>
        <Tarjeta><div className="text-xs uppercase tracking-wide text-slate-500">Documentos</div><div className="mt-1 text-2xl font-semibold">{filas.length}</div></Tarjeta>
      </div>
      <h2 className="text-sm font-semibold text-[#102027]">Ventas</h2>
      <Tabla id="analisis-ventas" columnas={columnas} vacio="No hay ventas cerradas en esta vista." filas={filas.map((fila) => ({ id: fila.id, celdas: celdas(fila) }))} />
      <h2 className="text-sm font-semibold text-[#102027]">Cuentas por cobrar</h2>
      <Tabla id="analisis-cxc" columnas={columnas} vacio="No hay saldos pendientes en esta vista." filas={filas.filter((fila) => fila.saldo > 0.001).map((fila) => ({ id: fila.id, celdas: celdas(fila) }))} />
    </Pagina>
  )
}
