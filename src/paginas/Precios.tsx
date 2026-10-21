import { useState } from 'react'
import { useErp } from '../datos/store'
import { guardarLista, guardarPrecios } from '../datos/motor'
import { quetzales } from '../dominio/formato'
import { Badge, Boton, Campo, Modal, Pagina, Tabla, Tarjeta, Texto } from '../componentes/ui'

export function Precios() {
  const { estado, puede, ejecutar } = useErp()
  const [listaId, setListaId] = useState(estado.listasPrecio.find((l) => l.esBase)?.id ?? estado.listasPrecio[0]?.id ?? '')
  const [montos, setMontos] = useState<Record<string, number>>({})
  const [nueva, setNueva] = useState(false)
  const [nombre, setNombre] = useState('')
  const lista = estado.listasPrecio.find((l) => l.id === listaId) ?? estado.listasPrecio[0]

  function precioDe(productoId: string) {
    if (montos[productoId] != null && lista?.id === listaId) return montos[productoId]
    return estado.precios.find((p) => p.listaId === lista?.id && p.productoId === productoId)?.precio
      ?? estado.productos.find((p) => p.id === productoId)?.precio
      ?? 0
  }

  function elegir(id: string) {
    setListaId(id)
    setMontos({})
  }

  return (
    <Pagina titulo="Listas de precios" detalle="La orden de venta toma estos precios como referencia. El punto de venta sigue el precio del producto." accion={puede('precios.editar') && <Boton onClick={() => { setNombre(''); setNueva(true) }}>Nueva lista</Boton>}>
      <Tabla
        columnas={['Código', 'Lista', 'Uso']}
        vacio="No hay listas."
        filas={estado.listasPrecio.map((item) => ({
          id: item.id,
          onClick: () => elegir(item.id),
          celdas: [
            item.codigo,
            <span key="n" className="font-medium">{item.nombre}</span>,
            <span key="u" className="flex gap-1">
              {item.esBase && <Badge tono="agua">Base</Badge>}
              <Badge tono={item.activa ? 'ok' : 'neutro'}>{item.activa ? 'Activa' : 'Inactiva'}</Badge>
              {lista?.id === item.id && <Badge tono="alerta">Abierta</Badge>}
            </span>,
          ],
        }))}
      />
      {lista && (
        <Tarjeta>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl">{lista.nombre}</h2>
            {puede('precios.editar') && !lista.esBase && (
              <Boton variante="secundario" onClick={() => ejecutar((actual) => guardarLista(actual, { id: lista.id, nombre: lista.nombre, activa: !lista.activa }))}>
                {lista.activa ? 'Desactivar' : 'Activar'}
              </Boton>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">Mostrador es el precio del producto. Lista es lo que propone el pedido.</p>
          <div className="mt-3 space-y-2">
            {estado.productos.filter((p) => p.activo).map((producto) => (
              <label key={producto.id} className="grid grid-cols-[minmax(0,1fr)_6rem_6.5rem] items-center gap-2 text-sm">
                <span className="min-w-0 break-words">{producto.nombre}</span>
                <span className="text-right text-xs text-slate-500">{quetzales(producto.precio)}</span>
                <Texto
                  aria-label={`Precio de ${producto.nombre}`}
                  type="number"
                  step="0.01"
                  min={0}
                  disabled={!puede('precios.editar')}
                  value={precioDe(producto.id)}
                  onChange={(e) => setMontos({ ...montos, [producto.id]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
          {puede('precios.editar') && (
            <div className="mt-3">
              <Boton onClick={() => {
                const items = estado.productos.filter((p) => p.activo).map((p) => ({ productoId: p.id, precio: precioDe(p.id) }))
                const resultado = ejecutar((actual) => guardarPrecios(actual, lista.id, items))
                if (resultado.ok) setMontos({})
              }}>Guardar precios</Boton>
            </div>
          )}
        </Tarjeta>
      )}
      <Modal titulo="Nueva lista" abierto={nueva} onCerrar={() => setNueva(false)}>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault()
          const resultado = ejecutar((actual) => guardarLista(actual, { nombre }))
          if (resultado.ok && resultado.id) {
            setListaId(resultado.id)
            setMontos({})
            setNueva(false)
          }
        }}>
          <Campo etiqueta="Nombre"><Texto value={nombre} onChange={(e) => setNombre(e.target.value)} required /></Campo>
          <p className="text-xs text-slate-500">Empieza con los precios de la lista general. Después los ajustás.</p>
          <Boton type="submit">Crear</Boton>
        </form>
      </Modal>
    </Pagina>
  )
}
