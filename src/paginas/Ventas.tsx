import { useState } from 'react'
import { useErp } from '../datos/store'
import { anularOrdenVenta, cerrarVentaInterna, confirmarOrdenVenta, crearOrdenVenta, emitirFactura, entregarEnMostrador } from '../datos/motor'
import { esConsumidorFinal, facturaVigente, folio, listaDelSocio, precioLista } from '../datos/consultas'
import { totalesVenta } from '../dominio/calculos'
import { formatoFecha, quetzales } from '../dominio/formato'
import { Buscador } from '../componentes/Buscador'
import { LineasDocumento } from '../componentes/LineasDocumento'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Texto } from '../componentes/ui'

interface LineaForm { productoId: string; cantidad: number; precioUnitario: number; descuento: number }

export function Ventas() {
  const { estado, sucursalActiva, sede, enVista, sesion, puede, ejecutar } = useErp()
  const [abierto, setAbierto] = useState(false)
  const sucursalId = sede
  const clientes = estado.socios.filter((s) => s.roles.includes('cliente') && s.estado === 'activo')
  const inicial = clientes.find((s) => s.sucursalId === sucursalId && !esConsumidorFinal(s.nit)) ?? clientes.find((s) => s.sucursalId === sucursalId) ?? clientes[0]
  const [socioId, setSocioId] = useState(inicial?.id ?? '')
  const [direccion, setDireccion] = useState(inicial?.direccion ?? '')
  const [ventana, setVentana] = useState('08:00–12:00')
  const [notas, setNotas] = useState('')
  const [confirmar, setConfirmar] = useState(true)
  const [facturar, setFacturar] = useState(true)
  const [receptorNombre, setReceptorNombre] = useState('')
  const [sectorId, setSectorId] = useState(inicial?.sectorId ?? '')
  const [listaId, setListaId] = useState(listaDelSocio(estado, inicial?.id ?? ''))
  const [lineas, setLineas] = useState<LineaForm[]>([{ productoId: 'prod-gar', cantidad: 10, precioUnitario: precioLista(estado, listaDelSocio(estado, inicial?.id ?? ''), 'prod-gar'), descuento: 0 }])

  const general = sucursalActiva === 'todas'
  const ordenes = estado.ordenesVenta.filter((o) => enVista(o.sucursalId))
  const productos = estado.productos.filter((p) => p.activo)

  function aplicarLista(id: string, actuales = lineas) {
    setListaId(id)
    setLineas(actuales.map((linea) => ({ ...linea, precioUnitario: precioLista(estado, id, linea.productoId) })))
  }

  function elegirSocio(id: string) {
    setSocioId(id)
    const socio = estado.socios.find((s) => s.id === id)
    if (socio) {
      setDireccion(socio.direccion)
      setSectorId(socio.sectorId ?? '')
      if (!esConsumidorFinal(socio.nit)) setReceptorNombre('')
    }
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
      facturar,
      receptorNombre,
      sectorId,
      listaPrecioId: listaId,
      lineas,
    }))
    if (resultado.ok) setAbierto(false)
  }

  return (
    <Pagina titulo="Órdenes de venta" detalle="El precio de venta incluye IVA. El correlativo de la serie se consume al crear la orden." accion={puede('ventas.editar') && <Boton onClick={() => setAbierto(true)}>Nueva orden</Boton>}>
      <Tabla
        columnas={['Documento', 'Fecha', ...(general ? ['Sucursal'] : []), 'Cliente', 'Estado', 'Total', 'Acciones']}
        vacio="No hay órdenes en esta sucursal."
        filas={ordenes.map((orden) => {
          const serie = estado.series.find((s) => s.id === orden.serieId)
          const factura = facturaVigente(estado, orden.id)
          return {
            id: orden.id,
            celdas: [
              folio(serie?.prefijo ?? 'OV', orden.numero),
              formatoFecha(orden.fecha),
              ...(general ? [estado.sucursales.find((s) => s.id === orden.sucursalId)?.codigo ?? ''] : []),
              estado.socios.find((s) => s.id === orden.socioId)?.nombre,
              <span key="e" className="flex gap-1"><Badge tono={orden.estado === 'entregada' ? 'ok' : orden.estado === 'en_ruta' ? 'alerta' : orden.estado === 'anulada' ? 'peligro' : 'agua'}>{orden.estado.replaceAll('_', ' ')}</Badge>{orden.facturar === false && <Badge tono="neutro">Sin FEL</Badge>}{factura && <Badge tono={factura.interna ? 'neutro' : factura.estado === 'cerrada' ? 'ok' : factura.estado === 'cancelada' ? 'peligro' : 'alerta'}>{factura.interna ? 'Interna' : factura.estado}</Badge>}</span>,
              quetzales(totalesVenta(orden.lineas).total),
              <span key="a" className="flex flex-wrap gap-1">
                {puede('ventas.editar') && orden.estado === 'borrador' && <Boton variante="secundario" onClick={() => ejecutar((e) => confirmarOrdenVenta(e, orden.id))}>Confirmar</Boton>}
                {puede('ventas.editar') && orden.estado === 'confirmada' && <Boton variante="secundario" onClick={() => ejecutar((e) => entregarEnMostrador(e, orden.id))}>Mostrador</Boton>}
                {puede('facturas.emitir') && orden.facturar !== false && orden.estado !== 'borrador' && orden.estado !== 'anulada' && !factura && <Boton onClick={() => ejecutar((e) => emitirFactura(e, orden.id))}>Facturar</Boton>}
                {puede('ventas.editar') && orden.facturar === false && orden.estado !== 'borrador' && orden.estado !== 'anulada' && !factura && <Boton onClick={() => ejecutar((e) => cerrarVentaInterna(e, orden.id))}>Cerrar sin FEL</Boton>}
                {puede('ventas.editar') && (orden.estado === 'borrador' || orden.estado === 'confirmada') && <Boton variante="peligro" onClick={() => ejecutar((e) => anularOrdenVenta(e, orden.id))}>Anular</Boton>}
              </span>,
            ],
          }
        })}
      />
      <Modal titulo="Nueva orden de venta" abierto={abierto} onCerrar={() => setAbierto(false)} ancho="max-w-4xl">
        <form className="space-y-3" onSubmit={guardar}>
          <Campo etiqueta="Cliente">
            <Buscador opciones={clientes.map((s) => ({ value: s.id, etiqueta: `${s.nombre} · ${s.nit}` }))} value={socioId} onChange={elegirSocio} placeholder="Nombre o NIT" />
          </Campo>
          <Campo etiqueta="Dirección de entrega"><Texto value={direccion} onChange={(e) => setDireccion(e.target.value)} /></Campo>
          <Campo etiqueta="Ventana"><Texto value={ventana} onChange={(e) => setVentana(e.target.value)} /></Campo>
          <Campo etiqueta="Lista de precios">
            <Lista value={listaId} onChange={(e) => aplicarLista(e.target.value)}>
              {estado.listasPrecio.filter((l) => l.activa).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </Lista>
          </Campo>
          <p className="text-xs text-[#5c6770]">El precio sale de la lista e incluye IVA. El importe de la línea ya lo trae. El subtotal es la base y el descuento se resta en quetzales.</p>
          <LineasDocumento modo="venta" productos={productos} lineas={lineas} onChange={setLineas} precioDe={(productoId) => precioLista(estado, listaId, productoId)} />
          <Campo etiqueta="Notas"><Texto value={notas} onChange={(e) => setNotas(e.target.value)} /></Campo>
          <Campo etiqueta="Sector">
            <Buscador required opciones={(estado.sectores ?? []).filter((sector) => sector.activo && sector.sucursalId === sucursalId).map((sector) => ({ value: sector.id, etiqueta: `${sector.codigo} · ${sector.nombre}` }))} value={sectorId} onChange={setSectorId} placeholder="Código o nombre del sector" />
          </Campo>
          {esConsumidorFinal(estado.socios.find((s) => s.id === socioId)?.nit ?? '') && (
            <Campo etiqueta="A quién se vendió"><Texto value={receptorNombre} onChange={(e) => setReceptorNombre(e.target.value)} placeholder="Nombre de quien recibe" /></Campo>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} /> Confirmar al guardar</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!facturar} onChange={(e) => setFacturar(!e.target.checked)} /> No enviar a facturar. Queda una venta interna, sin certificación FEL.</label>
          <Boton type="submit">Guardar orden</Boton>
        </form>
      </Modal>
    </Pagina>
  )
}
