import { useState } from 'react'
import { useErp } from '../datos/store'
import { anularOrdenVenta, confirmarOrdenVenta, crearOrdenVenta, emitirFactura, entregarEnMostrador } from '../datos/motor'
import { facturaVigente, folio, listaDelSocio, precioLista } from '../datos/consultas'
import { totalesVenta } from '../dominio/calculos'
import { formatoFecha, quetzales } from '../dominio/formato'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Texto } from '../componentes/ui'

interface LineaForm { productoId: string; cantidad: number; precioUnitario: number; descuento: number }

export function Ventas() {
  const { estado, sucursalActiva, sesion, puede, ejecutar } = useErp()
  const [abierto, setAbierto] = useState(false)
  const sucursalId = sucursalActiva === 'todas' ? estado.sucursales[0].id : sucursalActiva
  const clientes = estado.socios.filter((s) => s.roles.includes('cliente') && s.estado === 'activo')
  const inicial = clientes.find((s) => s.sucursalId === sucursalId) ?? clientes[0]
  const [socioId, setSocioId] = useState(inicial?.id ?? '')
  const [direccion, setDireccion] = useState(inicial?.direccion ?? '')
  const [ventana, setVentana] = useState('08:00–12:00')
  const [notas, setNotas] = useState('')
  const [confirmar, setConfirmar] = useState(true)
  const [listaId, setListaId] = useState(listaDelSocio(estado, inicial?.id ?? ''))
  const [lineas, setLineas] = useState<LineaForm[]>([{ productoId: 'prod-gar', cantidad: 10, precioUnitario: precioLista(estado, listaDelSocio(estado, inicial?.id ?? ''), 'prod-gar'), descuento: 0 }])

  const ordenes = estado.ordenesVenta.filter((o) => sucursalActiva === 'todas' || o.sucursalId === sucursalActiva)
  const productos = estado.productos.filter((p) => p.activo)

  function aplicarLista(id: string, actuales = lineas) {
    setListaId(id)
    setLineas(actuales.map((linea) => ({ ...linea, precioUnitario: precioLista(estado, id, linea.productoId) })))
  }

  function elegirSocio(id: string) {
    setSocioId(id)
    const socio = estado.socios.find((s) => s.id === id)
    if (socio) setDireccion(socio.direccion)
    aplicarLista(listaDelSocio(estado, id))
  }

  function guardar(event: React.FormEvent) {
    event.preventDefault()
    const socio = estado.socios.find((s) => s.id === socioId)
    const resultado = ejecutar((e) => crearOrdenVenta(e, {
      sucursalId,
      socioId,
      vendedorId: sesion?.id ?? '',
      direccionEntrega: direccion,
      lat: socio?.lat ?? 14.6,
      lng: socio?.lng ?? -90.51,
      ventana,
      notas,
      confirmar,
      listaPrecioId: listaId,
      lineas,
    }))
    if (resultado.ok) setAbierto(false)
  }

  return (
    <Pagina titulo="Órdenes de venta" detalle="El precio de venta incluye IVA. El correlativo de la serie se consume al crear la orden." accion={puede('ventas.editar') && <Boton onClick={() => setAbierto(true)}>Nueva orden</Boton>}>
      <Tabla
        columnas={['Documento', 'Fecha', 'Cliente', 'Estado', 'Total', 'Acciones']}
        vacio="No hay órdenes en esta sucursal."
        filas={ordenes.map((orden) => {
          const serie = estado.series.find((s) => s.id === orden.serieId)
          const factura = facturaVigente(estado, orden.id)
          return {
            id: orden.id,
            celdas: [
              folio(serie?.prefijo ?? 'OV', orden.numero),
              formatoFecha(orden.fecha),
              estado.socios.find((s) => s.id === orden.socioId)?.nombre,
              <span key="e" className="flex gap-1"><Badge tono={orden.estado === 'entregada' ? 'ok' : orden.estado === 'en_ruta' ? 'alerta' : orden.estado === 'anulada' ? 'peligro' : 'agua'}>{orden.estado.replaceAll('_', ' ')}</Badge>{factura && <Badge tono={factura.estado === 'cerrada' ? 'ok' : factura.estado === 'cancelada' ? 'peligro' : 'alerta'}>{factura.estado}</Badge>}</span>,
              quetzales(totalesVenta(orden.lineas).total),
              <span key="a" className="flex flex-wrap gap-1">
                {puede('ventas.editar') && orden.estado === 'borrador' && <Boton variante="secundario" onClick={() => ejecutar((e) => confirmarOrdenVenta(e, orden.id))}>Confirmar</Boton>}
                {puede('ventas.editar') && orden.estado === 'confirmada' && <Boton variante="secundario" onClick={() => ejecutar((e) => entregarEnMostrador(e, orden.id))}>Mostrador</Boton>}
                {puede('facturas.emitir') && orden.estado !== 'borrador' && orden.estado !== 'anulada' && !factura && <Boton onClick={() => ejecutar((e) => emitirFactura(e, orden.id))}>Facturar</Boton>}
                {puede('ventas.editar') && (orden.estado === 'borrador' || orden.estado === 'confirmada') && <Boton variante="peligro" onClick={() => ejecutar((e) => anularOrdenVenta(e, orden.id))}>Anular</Boton>}
              </span>,
            ],
          }
        })}
      />
      <Modal titulo="Nueva orden de venta" abierto={abierto} onCerrar={() => setAbierto(false)}>
        <form className="space-y-3" onSubmit={guardar}>
          <Campo etiqueta="Cliente">
            <Lista value={socioId} onChange={(e) => elegirSocio(e.target.value)}>
              {clientes.map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.nit}</option>)}
            </Lista>
          </Campo>
          <Campo etiqueta="Dirección de entrega"><Texto value={direccion} onChange={(e) => setDireccion(e.target.value)} /></Campo>
          <Campo etiqueta="Ventana"><Texto value={ventana} onChange={(e) => setVentana(e.target.value)} /></Campo>
          <Campo etiqueta="Lista de precios">
            <Lista value={listaId} onChange={(e) => aplicarLista(e.target.value)}>
              {estado.listasPrecio.filter((l) => l.activa).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </Lista>
          </Campo>
          <p className="text-xs text-[#5c6770]">El precio sale de la lista e incluye IVA. Podés cambiarlo en la línea. El descuento se resta en quetzales.</p>
          <div className="grid grid-cols-[minmax(0,1.4fr)_4.5rem_5.5rem_5.5rem] gap-2 text-xs font-semibold text-[#5c6770]">
            <span>Producto</span>
            <span>Cant.</span>
            <span>Precio</span>
            <span>Desc.</span>
          </div>
          {lineas.map((linea, indice) => (
            <div key={indice} className="grid grid-cols-[minmax(0,1.4fr)_4.5rem_5.5rem_5.5rem] gap-2">
              <Lista aria-label="Producto" value={linea.productoId} onChange={(e) => {
                const producto = productos.find((p) => p.id === e.target.value)
                setLineas(lineas.map((l, i) => i === indice ? { ...l, productoId: e.target.value, precioUnitario: producto ? precioLista(estado, listaId, producto.id) : l.precioUnitario } : l))
              }}>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Lista>
              <Texto aria-label="Cantidad" type="number" min={1} value={linea.cantidad} onChange={(e) => setLineas(lineas.map((l, i) => i === indice ? { ...l, cantidad: Number(e.target.value) } : l))} />
              <Texto aria-label="Precio unitario" type="number" step="0.01" value={linea.precioUnitario} onChange={(e) => setLineas(lineas.map((l, i) => i === indice ? { ...l, precioUnitario: Number(e.target.value) } : l))} />
              <Texto aria-label="Descuento" type="number" step="0.01" value={linea.descuento} onChange={(e) => setLineas(lineas.map((l, i) => i === indice ? { ...l, descuento: Number(e.target.value) } : l))} />
            </div>
          ))}
          <Boton type="button" variante="secundario" onClick={() => setLineas([...lineas, { productoId: productos[0].id, cantidad: 1, precioUnitario: precioLista(estado, listaId, productos[0].id), descuento: 0 }])}>Agregar línea</Boton>
          <Campo etiqueta="Notas"><Texto value={notas} onChange={(e) => setNotas(e.target.value)} /></Campo>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} /> Confirmar al guardar</label>
          <Boton type="submit">Guardar orden</Boton>
        </form>
      </Modal>
    </Pagina>
  )
}
