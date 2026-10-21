import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useErp } from '../datos/store'
import { deSucursal, folio, saldoFactura, stock } from '../datos/consultas'
import { totalesVenta } from '../dominio/calculos'
import { fechaGT, formatoFecha, quetzales } from '../dominio/formato'
import { Badge, Boton, Tabla, Tarjeta } from '../componentes/ui'

const INDICADORES = [
  { id: 'ventas', titulo: 'Ventas del mes' },
  { id: 'cobrar', titulo: 'Por cobrar' },
  { id: 'rutas', titulo: 'Rutas de hoy' },
  { id: 'abiertas', titulo: 'Facturas abiertas' },
]

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
  const { estado, sucursalActiva } = useErp()
  const [visibles, setVisibles] = useState(indicadoresGuardados)
  const [personalizar, setPersonalizar] = useState(false)
  const mes = fechaGT().slice(0, 7)
  const general = sucursalActiva === 'todas'
  const vista = general ? 'General' : (estado.sucursales.find((s) => s.id === sucursalActiva)?.nombre ?? 'Sucursal')
  const facturas = deSucursal(estado.facturas, sucursalActiva)
  const cerradas = facturas.filter((f) => f.estado === 'cerrada' && f.fecha.startsWith(mes))
  const vendido = cerradas.filter((f) => f.tipo === 'FACT' && !f.ajustada).reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
  const creditos = cerradas.filter((f) => f.tipo === 'NCRE').reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
  const debitos = cerradas.filter((f) => f.tipo === 'NDEB').reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
  const porCobrar = facturas.reduce((s, f) => s + saldoFactura(f), 0)
  const abiertas = facturas.filter((f) => f.estado === 'abierta').length
  const rutas = deSucursal(estado.rutas, sucursalActiva).filter((r) => r.fecha === fechaGT())
  const sucursales = sucursalActiva === 'todas' ? estado.sucursales : estado.sucursales.filter((s) => s.id === sucursalActiva)
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
          <p className="mt-1 text-sm text-[#4d5960]">{general ? 'Vista general. Cada sucursal va en su fila y el total cierra la tabla.' : `Vista ${vista}. Indicadores, documentos y rutas son de esta sucursal.`} Elegí qué indicadores ves.</p>
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
      {general && (
        <Tabla
          id="tablero-sucursales"
          columnas={['Sucursal', 'Ventas del mes', 'Por cobrar', 'Rutas de hoy', 'Facturas abiertas']}
          vacio="No hay sucursales."
          filas={[
            ...estado.sucursales.map((sucursal) => {
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
              factura.numero ? folio(serie?.prefijo ?? 'FAC', factura.numero) : 'Sin número',
              ...(general ? [estado.sucursales.find((s) => s.id === factura.sucursalId)?.codigo ?? ''] : []),
              factura.tipo === 'NCRE' ? 'Nota de crédito' : factura.tipo === 'NDEB' ? 'Nota de débito' : 'Factura',
              formatoFecha(factura.fecha),
              estado.socios.find((s) => s.id === factura.socioId)?.nombre,
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
