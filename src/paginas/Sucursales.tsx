import { useState } from 'react'
import { useErp } from '../datos/store'
import { guardarSucursal } from '../datos/motor'
import type { Sucursal } from '../dominio/tipos'
import { DEPARTAMENTOS } from '../dominio/permisos'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tarjeta, Texto } from '../componentes/ui'

const vacia = (): Omit<Sucursal, 'id'> => ({
  codigo: '', nombre: '', establecimientoSat: 4, direccion: '', municipio: 'Guatemala', departamento: 'Guatemala', codigoPostal: 1010, telefono: '', esMatriz: false, activa: true, lat: 14.63, lng: -90.51,
})

export function Sucursales() {
  const { estado, permitidas, puede, ejecutar } = useErp()
  const [form, setForm] = useState<(Omit<Sucursal, 'id'> & { id?: string }) | null>(null)
  return (
    <Pagina titulo="Sucursales" detalle="Cada sucursal es un establecimiento SAT. Las series, el inventario y las rutas viven en una sucursal." accion={puede('sucursales.editar') && <Boton onClick={() => setForm(vacia())}>Nueva sucursal</Boton>}>
      <div className="grid gap-3 md:grid-cols-3">
        {estado.sucursales.filter((s) => permitidas.includes(s.id)).map((s) => (
          <Tarjeta key={s.id}>
            <div className="flex items-center justify-between"><h2 className="font-display text-2xl">{s.nombre}</h2><Badge tono={s.activa ? 'ok' : 'neutro'}>{s.activa ? 'Activa' : 'Inactiva'}</Badge></div>
            <p className="mt-2 text-sm text-slate-600">{s.direccion}</p>
            <p className="text-sm">{s.municipio}, {s.departamento}</p>
            <p className="mt-2 text-sm">Establecimiento SAT {s.establecimientoSat} · {s.codigo}</p>
            <p className="text-sm text-slate-500">{s.telefono}</p>
            {puede('sucursales.editar') && <Boton className="mt-3" variante="secundario" onClick={() => setForm(s)}>Editar</Boton>}
          </Tarjeta>
        ))}
      </div>
      <Modal titulo="Sucursal" abierto={Boolean(form)} onCerrar={() => setForm(null)}>
        {form && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault()
            const resultado = ejecutar((actual) => guardarSucursal(actual, { ...form, establecimientoSat: Number(form.establecimientoSat), codigoPostal: Number(form.codigoPostal), lat: Number(form.lat), lng: Number(form.lng) }))
            if (resultado.ok) setForm(null)
          }}>
            <Campo etiqueta="Código"><Texto value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })} /></Campo>
            <Campo etiqueta="Nombre"><Texto value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Establecimiento SAT"><Texto type="number" value={form.establecimientoSat} onChange={(e) => setForm({ ...form, establecimientoSat: Number(e.target.value) })} /></Campo>
            <Campo etiqueta="Código postal"><Texto type="number" value={form.codigoPostal} onChange={(e) => setForm({ ...form, codigoPostal: Number(e.target.value) })} /></Campo>
            <div className="sm:col-span-2"><Campo etiqueta="Dirección"><Texto value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></Campo></div>
            <Campo etiqueta="Municipio"><Texto value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} /></Campo>
            <Campo etiqueta="Departamento">
              <Lista value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })}>
                {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
              </Lista>
            </Campo>
            <Campo etiqueta="Teléfono"><Texto value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Campo>
            <Campo etiqueta="Latitud"><Texto type="number" step="0.0001" value={form.lat} onChange={(e) => setForm({ ...form, lat: Number(e.target.value) })} /></Campo>
            <Campo etiqueta="Longitud"><Texto type="number" step="0.0001" value={form.lng} onChange={(e) => setForm({ ...form, lng: Number(e.target.value) })} /></Campo>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.esMatriz} onChange={(e) => setForm({ ...form, esMatriz: e.target.checked })} /> Es matriz</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} /> Activa</label>
            <div className="sm:col-span-2"><Boton type="submit">Guardar</Boton></div>
          </form>
        )}
      </Modal>
    </Pagina>
  )
}
