import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useErp } from '../datos/store'
import { registrarCobro, registrarVentaPos } from '../datos/motor'
import { stock } from '../datos/consultas'
import { totalesVenta } from '../dominio/calculos'
import { quetzales } from '../dominio/formato'
import type { FormaCobro } from '../dominio/tipos'
import { Boton, Campo, Lista, Modal, Pagina, Texto } from '../componentes/ui'

interface LineaPos {
  productoId: string
  cantidad: number
}

export function Pos() {
  const { estado, sesion, sucursalActiva, verEmpresa, ejecutar, certificar, certificando } = useErp()
  const [sucursalId, setSucursalId] = useState(sucursalActiva === 'todas' ? estado.sucursales.find((s) => s.esMatriz)?.id ?? estado.sucursales[0].id : sucursalActiva)
  useEffect(() => {
    if (sucursalActiva !== 'todas') setSucursalId(sucursalActiva)
  }, [sucursalActiva])
  const [socioId, setSocioId] = useState('soc-cf')
  const [carrito, setCarrito] = useState<LineaPos[]>([])
  const [pago, setPago] = useState(false)
  const [forma, setForma] = useState<FormaCobro>('efectivo')
  const [recibido, setRecibido] = useState('')
  const [referencia, setReferencia] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const productos = estado.productos.filter((p) => p.activo)
  const clientes = estado.socios.filter((s) => s.estado === 'activo' && s.roles.includes('cliente'))
  const sucursal = estado.sucursales.find((s) => s.id === sucursalId)
  const lineas = carrito.map((linea) => {
    const producto = productos.find((p) => p.id === linea.productoId)!
    return { producto, cantidad: linea.cantidad, precioUnitario: producto.precio, descuento: 0 }
  })
  const totales = totalesVenta(lineas.map((l) => ({
    cantidad: l.cantidad,
    precioUnitario: l.precioUnitario,
    descuento: 0,
    costoUnitario: l.producto.costo,
    gravable: l.producto.gravable,
    controlaInventario: l.producto.controlaInventario,
  })))
  const efectivo = Number(recibido)
  const cambio = forma === 'efectivo' ? Math.max(0, (Number.isFinite(efectivo) ? efectivo : 0) - totales.total) : 0
  const alcanza = forma !== 'efectivo' || (Number.isFinite(efectivo) && efectivo + 0.001 >= totales.total)

  function agregar(productoId: string) {
    setCarrito((actual) => {
      const previa = actual.find((l) => l.productoId === productoId)
      if (previa) return actual.map((l) => l.productoId === productoId ? { ...l, cantidad: l.cantidad + 1 } : l)
      return [...actual, { productoId, cantidad: 1 }]
    })
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setCarrito((actual) => actual.flatMap((l) => {
      if (l.productoId !== productoId) return [l]
      const cantidad = l.cantidad + delta
      return cantidad > 0 ? [{ ...l, cantidad }] : []
    }))
  }

  async function cobrar() {
    if (!sesion || !alcanza || ocupado) return
    setOcupado(true)
    try {
      const venta = ejecutar((actual) => registrarVentaPos(actual, {
        sucursalId,
        socioId,
        vendedorId: sesion.id,
        lineas: lineas.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad, precioUnitario: l.precioUnitario, descuento: 0 })),
      }))
      if (!venta.ok || !venta.id) return
      const ok = await certificar(venta.id)
      if (!ok) return
      const cobro = ejecutar((actual) => registrarCobro(actual, venta.id!, totales.total, forma, referencia.trim()))
      if (!cobro.ok) return
      setCarrito([])
      setPago(false)
      setRecibido('')
      setReferencia('')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Pagina titulo="Punto de venta" detalle={`${sucursal?.nombre ?? 'Sucursal'} · el cobro certifica la factura y deja el asiento de caja o banco.`}>
      {verEmpresa && (
        <Campo etiqueta="Sucursal del ticket">
          <Lista value={sucursalId} onChange={(e) => { setSucursalId(e.target.value); setCarrito([]) }}>
            {estado.sucursales.filter((s) => s.activa).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Lista>
        </Campo>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {productos.map((producto) => {
            const existencias = producto.controlaInventario ? stock(estado, sucursalId, producto.id) : null
            return (
              <button key={producto.id} type="button" onClick={() => agregar(producto.id)} className="rounded-md bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-cyan-400">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{producto.sku}</div>
                <div className="font-display mt-1 text-2xl text-[#083844]">{producto.nombre}</div>
                <div className="mt-3 flex items-end justify-between">
                  <strong>{quetzales(producto.precio)}</strong>
                  <span className="text-xs text-slate-500">{existencias === null ? 'Servicio' : `${existencias} en sucursal`}</span>
                </div>
              </button>
            )
          })}
        </div>
        <aside className="rounded-md bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <Campo etiqueta="Cliente">
            <Lista value={socioId} onChange={(e) => setSocioId(e.target.value)} className="bg-white text-[#083844]">
              {clientes.map((s) => <option key={s.id} value={s.id}>{s.nombreComercial || s.nombre}</option>)}
            </Lista>
          </Campo>
          <ul className="mt-4 space-y-3">
            {lineas.length === 0 && <li className="text-sm text-slate-500">Tocá un producto para armar el ticket.</li>}
            {lineas.map((linea) => (
              <li key={linea.producto.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <div>{linea.producto.nombre}</div>
                  <div className="text-slate-500">{quetzales(linea.precioUnitario)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-slate-100" onClick={() => cambiarCantidad(linea.producto.id, -1)}><Minus size={14} /></button>
                  <span className="w-6 text-center">{linea.cantidad}</span>
                  <button type="button" className="grid h-8 w-8 place-items-center rounded-full bg-slate-100" onClick={() => cambiarCantidad(linea.producto.id, 1)}><Plus size={14} /></button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-end justify-between border-t border-slate-200 pt-4">
            <span className="text-sm text-slate-500">Total con IVA</span>
            <span className="font-display text-4xl">{quetzales(totales.total)}</span>
          </div>
          <Boton className="mt-4 w-full" disabled={lineas.length === 0} onClick={() => { setRecibido(totales.total.toFixed(2)); setPago(true) }}>Cobrar</Boton>
        </aside>
      </div>
      <Modal titulo="Cobro" abierto={pago} onCerrar={() => !ocupado && setPago(false)} ancho="max-w-md">
        <div className="space-y-3">
          <div className="font-display text-4xl text-[#083844]">{quetzales(totales.total)}</div>
          <div className="flex gap-2">
            {(['efectivo', 'tarjeta', 'transferencia'] as const).map((opcion) => (
              <Boton key={opcion} variante={forma === opcion ? 'primario' : 'secundario'} onClick={() => setForma(opcion)}>{opcion}</Boton>
            ))}
          </div>
          {forma === 'efectivo' && (
            <Campo etiqueta="Efectivo recibido">
              <Texto type="number" step="0.01" value={recibido} onChange={(e) => setRecibido(e.target.value)} />
            </Campo>
          )}
          {forma !== 'efectivo' && (
            <Campo etiqueta="Referencia">
              <Texto value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Autorización o boleta" />
            </Campo>
          )}
          {forma === 'efectivo' && <p className="text-sm">Cambio {quetzales(cambio)}</p>}
          <Boton disabled={!alcanza || ocupado || certificando !== null} onClick={cobrar}>{ocupado ? 'Certificando…' : 'Certificar y cobrar'}</Boton>
        </div>
      </Modal>
    </Pagina>
  )
}
