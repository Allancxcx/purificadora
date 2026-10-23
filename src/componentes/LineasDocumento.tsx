import { Trash2 } from 'lucide-react'
import { redondear, totalesCompra, totalesVenta } from '../dominio/calculos'
import { quetzales } from '../dominio/formato'
import type { Producto } from '../dominio/tipos'
import { Buscador } from './Buscador'
import { Boton, Texto } from './ui'

interface LineaVenta {
  productoId: string
  cantidad: number
  precioUnitario: number
  descuento: number
}

interface LineaCompra {
  productoId: string
  cantidad: number
  costoUnitario: number
}

type Props =
  | { modo: 'venta'; productos: Producto[]; lineas: LineaVenta[]; onChange: (lineas: LineaVenta[]) => void; precioDe: (productoId: string) => number }
  | { modo: 'compra'; productos: Producto[]; lineas: LineaCompra[]; onChange: (lineas: LineaCompra[]) => void }

function siguiente(productos: Producto[], usados: string[]) {
  return productos.find((producto) => !usados.includes(producto.id)) ?? productos[0]
}

function Totales({ filas, total }: { filas: { etiqueta: string; valor: number }[]; total: number }) {
  return (
    <dl className="min-w-52 space-y-1 text-sm">
      {filas.map((fila) => (
        <div key={fila.etiqueta} className="flex justify-between gap-6 text-[#5c6770]"><dt>{fila.etiqueta}</dt><dd className="tabular-nums">{quetzales(fila.valor)}</dd></div>
      ))}
      <div className="flex justify-between gap-6 border-t border-[#d5dde2] pt-1 text-base font-semibold text-[#102027]"><dt>Total</dt><dd className="tabular-nums">{quetzales(total)}</dd></div>
    </dl>
  )
}

function ProductoLista({ productos, value, onChange }: { productos: Producto[]; value: string; onChange: (id: string) => void }) {
  return (
    <Buscador
      ariaLabel="Producto"
      opciones={productos.map((item) => ({ value: item.id, etiqueta: `${item.nombre} · ${item.unidad}` }))}
      value={value}
      onChange={onChange}
      placeholder="Buscá el producto"
    />
  )
}

export function LineasDocumento(props: Props) {
  const { productos } = props
  if (productos.length === 0) return <p className="text-sm text-slate-500">No hay productos activos para agregar.</p>

  if (props.modo === 'venta') {
    const totales = totalesVenta(props.lineas.map((linea) => {
      const producto = productos.find((item) => item.id === linea.productoId)
      return {
        cantidad: linea.cantidad,
        precioUnitario: linea.precioUnitario,
        descuento: linea.descuento,
        costoUnitario: producto?.costo ?? 0,
        gravable: producto?.gravable ?? true,
        controlaInventario: producto?.controlaInventario,
      }
    }))
    const filas = [
      ...(totales.descuento > 0 ? [{ etiqueta: 'Bruto', valor: totales.bruto }, { etiqueta: 'Descuento', valor: totales.descuento }] : []),
      { etiqueta: 'Subtotal', valor: totales.gravable },
      { etiqueta: 'IVA 12%', valor: totales.iva },
    ]
    return (
      <div className="space-y-2">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-[#5c6770]">
                <th className="pb-1 pr-2 font-semibold">Producto</th>
                <th className="w-20 pb-1 pr-2 font-semibold">Cant.</th>
                <th className="w-24 pb-1 pr-2 font-semibold">Precio</th>
                <th className="w-24 pb-1 pr-2 font-semibold">Desc. Q</th>
                <th className="w-28 pb-1 pr-2 text-right font-semibold">Importe</th>
                <th className="w-10 pb-1" />
              </tr>
            </thead>
            <tbody>
              {props.lineas.map((linea, indice) => {
                const importe = redondear(redondear(linea.cantidad * linea.precioUnitario) - redondear(linea.descuento))
                const descuentoRoto = linea.descuento > redondear(linea.cantidad * linea.precioUnitario)
                return (
                  <tr key={indice} className="align-top">
                    <td className="py-1 pr-2">
                      <ProductoLista productos={productos} value={linea.productoId} onChange={(id) => {
                        const elegido = productos.find((item) => item.id === id)
                        props.onChange(props.lineas.map((actual, i) => i === indice ? { ...actual, productoId: id, precioUnitario: elegido ? props.precioDe(elegido.id) : actual.precioUnitario } : actual))
                      }} />
                    </td>
                    <td className="py-1 pr-2"><Texto aria-label="Cantidad" type="number" min={1} value={linea.cantidad} onChange={(e) => props.onChange(props.lineas.map((actual, i) => i === indice ? { ...actual, cantidad: Number(e.target.value) } : actual))} /></td>
                    <td className="py-1 pr-2"><Texto aria-label="Precio unitario" type="number" step="0.01" min={0} value={linea.precioUnitario} onChange={(e) => props.onChange(props.lineas.map((actual, i) => i === indice ? { ...actual, precioUnitario: Number(e.target.value) } : actual))} /></td>
                    <td className="py-1 pr-2"><Texto aria-label="Descuento" type="number" step="0.01" min={0} value={linea.descuento} onChange={(e) => props.onChange(props.lineas.map((actual, i) => i === indice ? { ...actual, descuento: Number(e.target.value) } : actual))} /></td>
                    <td className={`py-2 pr-2 text-right font-medium tabular-nums ${descuentoRoto ? 'text-[#8a1f1f]' : 'text-[#102027]'}`}>
                      {quetzales(importe)}
                      {descuentoRoto && <div className="text-[11px] font-normal">Pasa del importe</div>}
                    </td>
                    <td className="py-1 text-right">
                      <Boton type="button" variante="fantasma" className="px-2" aria-label="Quitar línea" disabled={props.lineas.length === 1} onClick={() => props.onChange(props.lineas.filter((_, i) => i !== indice))}><Trash2 size={16} /></Boton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Boton type="button" variante="secundario" onClick={() => {
            const producto = siguiente(productos, props.lineas.map((linea) => linea.productoId))
            if (!producto) return
            props.onChange([...props.lineas, { productoId: producto.id, cantidad: 1, precioUnitario: props.precioDe(producto.id), descuento: 0 }])
          }}>Agregar línea</Boton>
          <Totales filas={filas} total={totales.total} />
        </div>
      </div>
    )
  }

  const totales = totalesCompra(props.lineas.map((linea) => {
    const producto = productos.find((item) => item.id === linea.productoId)
    return {
      cantidad: linea.cantidad,
      costoUnitario: linea.costoUnitario,
      gravable: producto?.gravable ?? true,
      controlaInventario: producto?.controlaInventario ?? true,
    }
  }))
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-[#5c6770]">
              <th className="pb-1 pr-2 font-semibold">Producto</th>
              <th className="w-20 pb-1 pr-2 font-semibold">Cant.</th>
              <th className="w-24 pb-1 pr-2 font-semibold">Costo</th>
              <th className="w-28 pb-1 pr-2 text-right font-semibold">Importe</th>
              <th className="w-10 pb-1" />
            </tr>
          </thead>
          <tbody>
            {props.lineas.map((linea, indice) => (
              <tr key={indice} className="align-top">
                <td className="py-1 pr-2">
                  <ProductoLista productos={productos} value={linea.productoId} onChange={(id) => {
                    const elegido = productos.find((item) => item.id === id)
                    props.onChange(props.lineas.map((actual, i) => i === indice ? { ...actual, productoId: id, costoUnitario: elegido?.costo ?? actual.costoUnitario } : actual))
                  }} />
                </td>
                <td className="py-1 pr-2"><Texto aria-label="Cantidad" type="number" min={1} value={linea.cantidad} onChange={(e) => props.onChange(props.lineas.map((actual, i) => i === indice ? { ...actual, cantidad: Number(e.target.value) } : actual))} /></td>
                <td className="py-1 pr-2"><Texto aria-label="Costo unitario" type="number" step="0.01" min={0} value={linea.costoUnitario} onChange={(e) => props.onChange(props.lineas.map((actual, i) => i === indice ? { ...actual, costoUnitario: Number(e.target.value) } : actual))} /></td>
                <td className="py-2 pr-2 text-right font-medium tabular-nums text-[#102027]">{quetzales(redondear(linea.cantidad * linea.costoUnitario))}</td>
                <td className="py-1 text-right">
                  <Boton type="button" variante="fantasma" className="px-2" aria-label="Quitar línea" disabled={props.lineas.length === 1} onClick={() => props.onChange(props.lineas.filter((_, i) => i !== indice))}><Trash2 size={16} /></Boton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Boton type="button" variante="secundario" onClick={() => {
          const producto = siguiente(productos, props.lineas.map((linea) => linea.productoId))
          if (!producto) return
          props.onChange([...props.lineas, { productoId: producto.id, cantidad: 1, costoUnitario: producto.costo }])
        }}>Agregar línea</Boton>
        <Totales filas={[{ etiqueta: 'Subtotal', valor: totales.base }, { etiqueta: 'IVA 12%', valor: totales.iva }]} total={totales.total} />
      </div>
    </div>
  )
}
