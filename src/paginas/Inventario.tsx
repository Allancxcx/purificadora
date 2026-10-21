import { useState } from 'react'
import { useErp } from '../datos/store'
import { guardarProducto } from '../datos/motor'
import { saldoCuenta, stock, valorInventario } from '../datos/consultas'
import { CTA } from '../dominio/calculos'
import { quetzales } from '../dominio/formato'
import type { Producto } from '../dominio/tipos'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Tarjeta, Texto } from '../componentes/ui'

const nuevo = (): Omit<Producto, 'id'> => ({
  sku: '', nombre: '', unidad: 'UNI', bienOServicio: 'B', precio: 0, costo: 0, gravable: true, controlaInventario: true, minimo: 0, activo: true,
})

export function Inventario() {
  const { estado, sucursalActiva, puede, ejecutar } = useErp()
  const [productoId, setProductoId] = useState('prod-gar')
  const [form, setForm] = useState<(Omit<Producto, 'id'> & { id?: string }) | null>(null)
  const sucursales = estado.sucursales.filter((s) => sucursalActiva === 'todas' || s.id === sucursalActiva)
  const valor = valorInventario(estado, sucursalActiva === 'todas' ? undefined : sucursalActiva)
  const contable = sucursalActiva === 'todas' ? saldoCuenta(estado, CTA.inventario) : null
  const movimientos = estado.movimientos.filter((m) => m.productoId === productoId && (sucursalActiva === 'todas' || m.sucursalId === sucursalActiva)).slice().reverse().slice(0, 12)

  return (
    <Pagina titulo="Inventario" detalle="El kardex es la existencia. El camión descuenta al salir y la factura de mostrador descuenta al certificarse." accion={puede('productos.editar') && <Boton onClick={() => setForm(nuevo())}>Nuevo producto</Boton>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Tarjeta><div className="text-xs uppercase tracking-[0.14em] text-slate-500">Valor a costo estándar</div><div className="font-display mt-1 text-3xl">{quetzales(valor)}</div></Tarjeta>
        <Tarjeta><div className="text-xs uppercase tracking-[0.14em] text-slate-500">Cuenta 1301</div><div className="font-display mt-1 text-3xl">{contable === null ? 'Por sucursal no se parte' : quetzales(contable)}</div></Tarjeta>
      </div>
      <Tabla
        columnas={['SKU', 'Producto', ...sucursales.map((s) => s.codigo), 'Mínimo']}
        vacio="No hay productos."
        filas={estado.productos.map((p) => ({
          id: p.id,
          onClick: () => setProductoId(p.id),
          celdas: [
            p.sku,
            <button key="n" className="text-left font-medium" onClick={(e) => { e.stopPropagation(); if (puede('productos.editar')) setForm(p) }}>{p.nombre}</button>,
            ...sucursales.map((s) => {
              const cantidad = stock(estado, s.id, p.id)
              return <span key={s.id}>{p.controlaInventario ? <Badge tono={cantidad < p.minimo ? 'alerta' : 'ok'}>{cantidad}</Badge> : '—'}</span>
            }),
            p.controlaInventario ? p.minimo : 'Servicio',
          ],
        }))}
      />
      <Tarjeta>
        <h2 className="font-display text-2xl">Kardex · {estado.productos.find((p) => p.id === productoId)?.nombre}</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {movimientos.map((m) => (
            <li key={m.id} className="flex justify-between gap-3 border-b border-slate-100 py-1">
              <span>{m.fecha} · {m.concepto} · {m.referencia}</span>
              <span className={m.tipo === 'entrada' ? 'text-emerald-700' : 'text-rose-700'}>{m.tipo === 'entrada' ? '+' : '−'}{m.cantidad}</span>
            </li>
          ))}
        </ul>
      </Tarjeta>
      <Modal titulo={form?.id ? 'Editar producto' : 'Nuevo producto'} abierto={Boolean(form)} onCerrar={() => setForm(null)}>
        {form && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault()
            const resultado = ejecutar((estadoActual) => guardarProducto(estadoActual, form))
            if (resultado.ok) setForm(null)
          }}>
            <Campo etiqueta="SKU"><Texto value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Campo>
            <Campo etiqueta="Nombre"><Texto value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Unidad SAT"><Texto value={form.unidad} maxLength={3} onChange={(e) => setForm({ ...form, unidad: e.target.value })} /></Campo>
            <Campo etiqueta="Bien o servicio">
              <Lista value={form.bienOServicio} onChange={(e) => setForm({ ...form, bienOServicio: e.target.value as 'B' | 'S' })}>
                <option value="B">Bien</option>
                <option value="S">Servicio</option>
              </Lista>
            </Campo>
            <Campo etiqueta="Precio con IVA"><Texto type="number" step="0.01" value={form.precio} onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })} /></Campo>
            <Campo etiqueta="Costo sin IVA"><Texto type="number" step="0.01" value={form.costo} onChange={(e) => setForm({ ...form, costo: Number(e.target.value) })} /></Campo>
            <Campo etiqueta="Mínimo"><Texto type="number" value={form.minimo} onChange={(e) => setForm({ ...form, minimo: Number(e.target.value) })} /></Campo>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.controlaInventario} onChange={(e) => setForm({ ...form, controlaInventario: e.target.checked })} /> Controla inventario</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.gravable} onChange={(e) => setForm({ ...form, gravable: e.target.checked })} /> Gravado con IVA</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Activo</label>
            <div className="sm:col-span-2"><Boton type="submit">Guardar</Boton></div>
          </form>
        )}
      </Modal>
    </Pagina>
  )
}
