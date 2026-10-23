import { useState } from 'react'
import { useErp } from '../datos/store'
import { anularOrdenCompra, crearOrdenCompra, pagarProveedor, recibirOrdenCompra } from '../datos/motor'
import { bancosActivos, folio, saldoBanco, saldoCompra } from '../datos/consultas'
import { totalesCompra } from '../dominio/calculos'
import { formatoFecha, quetzales } from '../dominio/formato'
import type { FormaCobro } from '../dominio/tipos'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Texto } from '../componentes/ui'

export function Compras() {
  const { estado, sucursalActiva, permitidas, sede, enVista, puede, ejecutar } = useErp()
  const [abierto, setAbierto] = useState(false)
  const sucursalId = sede
  const proveedores = estado.socios.filter((s) => s.roles.includes('proveedor') && s.estado === 'activo')
  const productos = estado.productos.filter((p) => p.activo && p.controlaInventario)
  const [socioId, setSocioId] = useState(proveedores[0]?.id ?? '')
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState([{ productoId: productos[0]?.id ?? '', cantidad: 40, costoUnitario: productos[0]?.costo ?? 0 }])
  const [pago, setPago] = useState<string | null>(null)
  const [monto, setMonto] = useState(0)
  const [bancoId, setBancoId] = useState('ban-bi')
  const [forma, setForma] = useState<FormaCobro>('transferencia')
  const [facturaProveedor, setFacturaProveedor] = useState('')
  const [referencia, setReferencia] = useState('')
  const general = sucursalActiva === 'todas'
  const bancos = bancosActivos(estado, permitidas)
  const ordenes = estado.ordenesCompra.filter((o) => enVista(o.sucursalId))

  function guardar(event: React.FormEvent) {
    event.preventDefault()
    const resultado = ejecutar((e) => crearOrdenCompra(e, { sucursalId, socioId, notas, lineas }))
    if (resultado.ok) setAbierto(false)
  }

  return (
    <Pagina titulo="Órdenes de compra" detalle="El costo va sin IVA. Al recibir queda la cuenta por pagar. Pagala desde la cuenta bancaria que elijas. La factura del proveedor no se ajusta con una nota de débito: ese documento solo se emite a un cliente." accion={puede('compras.editar') && <Boton onClick={() => setAbierto(true)}>Nueva compra</Boton>}>
      <Tabla
        columnas={['Documento', 'Fecha', ...(general ? ['Sucursal'] : []), 'Proveedor', 'Factura proveedor', 'Estado', 'Total', 'Saldo', '']}
        vacio="No hay compras en esta sucursal."
        filas={ordenes.map((orden) => {
          const serie = estado.series.find((s) => s.id === orden.serieId)
          return {
            id: orden.id,
            celdas: [
              folio(serie?.prefijo ?? 'OC', orden.numero),
              formatoFecha(orden.fecha),
              ...(general ? [estado.sucursales.find((s) => s.id === orden.sucursalId)?.codigo ?? ''] : []),
              estado.socios.find((s) => s.id === orden.socioId)?.nombre,
              orden.facturaProveedor ?? '',
              <Badge key="e" tono={orden.estado === 'recibida' ? 'ok' : orden.estado === 'anulada' ? 'peligro' : 'alerta'}>{orden.estado}</Badge>,
              quetzales(totalesCompra(orden.lineas).total),
              orden.estado === 'recibida' ? quetzales(saldoCompra(estado, orden.id)) : '',
              puede('compras.editar') && orden.estado === 'borrador' ? (
                <span key="a" className="flex gap-1">
                  <Boton onClick={() => ejecutar((e) => recibirOrdenCompra(e, orden.id))}>Recibir</Boton>
                  <Boton variante="peligro" onClick={() => ejecutar((e) => anularOrdenCompra(e, orden.id))}>Anular</Boton>
                </span>
              ) : puede('compras.editar') && orden.estado === 'recibida' && saldoCompra(estado, orden.id) > 0 ? (
                <Boton key="p" onClick={() => { setPago(orden.id); setMonto(saldoCompra(estado, orden.id)); setReferencia(''); setForma('transferencia'); setFacturaProveedor(orden.facturaProveedor ?? ''); setBancoId(bancos[0]?.id ?? '') }}>Pagar</Boton>
              ) : <span key="v" className="text-xs text-slate-400">{orden.estado === 'recibida' ? 'Pagada' : orden.notas}</span>,
            ],
          }
        })}
      />
      <Modal titulo="Nueva orden de compra" abierto={abierto} onCerrar={() => setAbierto(false)}>
        <form className="space-y-3" onSubmit={guardar}>
          <Campo etiqueta="Proveedor">
            <Lista value={socioId} onChange={(e) => setSocioId(e.target.value)}>
              {proveedores.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Lista>
          </Campo>
          <div className="grid grid-cols-[1.4fr_80px_100px] gap-2 text-xs font-semibold text-[#5c6770]">
            <span>Producto</span>
            <span>Cantidad</span>
            <span>Costo Q</span>
          </div>
          {lineas.map((linea, indice) => (
            <div key={indice} className="grid grid-cols-[1.4fr_80px_100px] gap-2">
              <Lista aria-label="Producto" value={linea.productoId} onChange={(e) => {
                const producto = productos.find((p) => p.id === e.target.value)
                setLineas(lineas.map((l, i) => i === indice ? { ...l, productoId: e.target.value, costoUnitario: producto?.costo ?? l.costoUnitario } : l))
              }}>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Lista>
              <Texto aria-label="Cantidad" type="number" min={1} value={linea.cantidad} onChange={(e) => setLineas(lineas.map((l, i) => i === indice ? { ...l, cantidad: Number(e.target.value) } : l))} />
              <Texto aria-label="Costo unitario" type="number" step="0.01" value={linea.costoUnitario} onChange={(e) => setLineas(lineas.map((l, i) => i === indice ? { ...l, costoUnitario: Number(e.target.value) } : l))} />
            </div>
          ))}
          <Boton type="button" variante="secundario" onClick={() => setLineas([...lineas, { productoId: productos[0].id, cantidad: 1, costoUnitario: productos[0].costo }])}>Agregar línea</Boton>
          <Campo etiqueta="Notas"><Texto value={notas} onChange={(e) => setNotas(e.target.value)} /></Campo>
          <Boton type="submit">Guardar compra</Boton>
        </form>
      </Modal>
      <Modal titulo="Pagar al proveedor" abierto={Boolean(pago)} onCerrar={() => setPago(null)}>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault()
          if (!pago) return
          const resultado = ejecutar((actual) => pagarProveedor(actual, pago, monto, forma, forma === 'efectivo' ? '' : bancoId, referencia, undefined, facturaProveedor))
          if (resultado.ok) setPago(null)
        }}>
          <Campo etiqueta="Forma">
            <Lista value={forma} onChange={(e) => setForma(e.target.value as FormaCobro)}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </Lista>
          </Campo>
          {forma !== 'efectivo' && (
            <Campo etiqueta="Cuenta bancaria">
              <Lista value={bancoId} onChange={(e) => setBancoId(e.target.value)}>
                {bancos.map((b) => <option key={b.id} value={b.id}>{b.nombre} · {quetzales(saldoBanco(estado, b.id))}</option>)}
              </Lista>
            </Campo>
          )}
          <Campo etiqueta="Factura del proveedor"><Texto value={facturaProveedor} onChange={(e) => setFacturaProveedor(e.target.value)} placeholder="Número de factura" /></Campo>
          <Campo etiqueta="Monto"><Texto type="number" step="0.01" value={monto} onChange={(e) => setMonto(Number(e.target.value))} /></Campo>
          <Campo etiqueta={forma === 'tarjeta' ? 'Autorización' : forma === 'efectivo' ? 'Recibo' : 'Número de transferencia'}><Texto value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder={forma === 'transferencia' ? 'Número de transferencia' : ''} /></Campo>
          <Boton type="submit">Registrar pago</Boton>
        </form>
      </Modal>
    </Pagina>
  )
}
