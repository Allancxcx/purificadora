import { useState } from 'react'
import { useErp } from '../datos/store'
import { anularOrdenCompra, crearOrdenCompra, recibirOrdenCompra } from '../datos/motor'
import { folio } from '../datos/consultas'
import { totalesCompra } from '../dominio/calculos'
import { formatoFecha, quetzales } from '../dominio/formato'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Texto } from '../componentes/ui'

export function Compras() {
  const { estado, sucursalActiva, puede, ejecutar } = useErp()
  const [abierto, setAbierto] = useState(false)
  const sucursalId = sucursalActiva === 'todas' ? estado.sucursales[0].id : sucursalActiva
  const proveedores = estado.socios.filter((s) => s.roles.includes('proveedor') && s.estado === 'activo')
  const productos = estado.productos.filter((p) => p.activo && p.controlaInventario)
  const [socioId, setSocioId] = useState(proveedores[0]?.id ?? '')
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState([{ productoId: productos[0]?.id ?? '', cantidad: 40, costoUnitario: productos[0]?.costo ?? 0 }])
  const ordenes = estado.ordenesCompra.filter((o) => sucursalActiva === 'todas' || o.sucursalId === sucursalActiva)

  function guardar(event: React.FormEvent) {
    event.preventDefault()
    const resultado = ejecutar((e) => crearOrdenCompra(e, { sucursalId, socioId, notas, lineas }))
    if (resultado.ok) setAbierto(false)
  }

  return (
    <Pagina titulo="Órdenes de compra" detalle="El costo va sin IVA. Al recibir entra el inventario, el IVA crédito y la cuenta por pagar. La factura del proveedor no se ajusta con una nota de débito: ese documento solo se emite a un cliente." accion={puede('compras.editar') && <Boton onClick={() => setAbierto(true)}>Nueva compra</Boton>}>
      <Tabla
        columnas={['Documento', 'Fecha', 'Proveedor', 'Estado', 'Total', '']}
        vacio="No hay compras en esta sucursal."
        filas={ordenes.map((orden) => {
          const serie = estado.series.find((s) => s.id === orden.serieId)
          return {
            id: orden.id,
            celdas: [
              folio(serie?.prefijo ?? 'OC', orden.numero),
              formatoFecha(orden.fecha),
              estado.socios.find((s) => s.id === orden.socioId)?.nombre,
              <Badge key="e" tono={orden.estado === 'recibida' ? 'ok' : orden.estado === 'anulada' ? 'peligro' : 'alerta'}>{orden.estado}</Badge>,
              quetzales(totalesCompra(orden.lineas).total),
              puede('compras.editar') && orden.estado === 'borrador' ? (
                <span key="a" className="flex gap-1">
                  <Boton onClick={() => ejecutar((e) => recibirOrdenCompra(e, orden.id))}>Recibir</Boton>
                  <Boton variante="peligro" onClick={() => ejecutar((e) => anularOrdenCompra(e, orden.id))}>Anular</Boton>
                </span>
              ) : <span key="v" className="text-xs text-slate-400">{orden.notas}</span>,
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
    </Pagina>
  )
}
