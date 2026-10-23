import { useMemo, useState } from 'react'
import { useErp } from '../datos/store'
import { guardarSocio } from '../datos/motor'
import type { RolSocio, Socio } from '../dominio/tipos'
import { DEPARTAMENTOS } from '../dominio/permisos'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Tarjeta, Texto, Area } from '../componentes/ui'
import { SelectorMapa } from '../componentes/Mapa'

type Borrador = Omit<Socio, 'id' | 'codigo'> & { id?: string }

const vacio = (sucursalId: string): Borrador => ({
  nombre: '', nombreComercial: '', nit: '', roles: ['cliente'], telefono: '', correo: '', direccion: '',
  municipio: 'Guatemala', departamento: 'Guatemala', sucursalId, lat: 14.5994, lng: -90.5138,
  limiteCredito: 0, diasCredito: 0, estado: 'activo', listaPrecioId: 'lista-general', sectorId: '', notas: '',
})

export function Socios() {
  const { estado, sucursalActiva, permitidas, sede, enVista, puede, ejecutar } = useErp()
  const [q, setQ] = useState('')
  const [rol, setRol] = useState<'todos' | RolSocio>('todos')
  const [form, setForm] = useState<Borrador | null>(null)
  const sucursalDefault = sede

  const filas = useMemo(() => estado.socios.filter((s) => {
    if (!enVista(s.sucursalId)) return false
    if (rol !== 'todos' && !s.roles.includes(rol)) return false
    const texto = `${s.nombre} ${s.nit} ${s.codigo}`.toLowerCase()
    return texto.includes(q.toLowerCase())
  }), [estado.socios, sucursalActiva, permitidas, enVista, rol, q])

  function guardar(event: React.FormEvent) {
    event.preventDefault()
    if (!form) return
    const resultado = ejecutar((e) => guardarSocio(e, form))
    if (resultado.ok) setForm(null)
  }

  function alternar(actual: RolSocio) {
    if (!form) return
    const tiene = form.roles.includes(actual)
    const roles = tiene ? form.roles.filter((r) => r !== actual) : [...form.roles, actual]
    setForm({ ...form, roles })
  }

  return (
    <Pagina titulo="Socios de negocio" detalle="Una misma ficha puede ser cliente, proveedor y lead. La factura solo sale si tiene el rol de cliente." accion={puede('socios.editar') && <Boton onClick={() => setForm(vacio(sucursalDefault))}>Nuevo socio</Boton>}>
      <Tarjeta className="flex flex-wrap gap-2">
        <Texto placeholder="Buscar nombre o NIT" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        {(['todos', 'cliente', 'proveedor', 'lead'] as const).map((item) => (
          <Boton key={item} variante={rol === item ? 'primario' : 'secundario'} onClick={() => setRol(item)}>{item}</Boton>
        ))}
      </Tarjeta>
      <Tabla
        columnas={['Código', 'Nombre', 'NIT', 'Roles', 'Sucursal', 'Sector', 'Crédito']}
        vacio="No hay socios con ese filtro."
        filas={filas.map((s) => ({
          id: s.id,
          onClick: puede('socios.editar') ? () => setForm(s) : undefined,
          celdas: [
            s.codigo,
            <div key="n"><div className="font-medium">{s.nombre}</div><div className="text-xs text-slate-500">{s.nombreComercial}</div></div>,
            s.nit,
            <span key="r" className="flex gap-1">{s.roles.map((r) => <Badge key={r} tono={r === 'lead' ? 'alerta' : r === 'proveedor' ? 'agua' : 'ok'}>{r}</Badge>)}</span>,
            estado.sucursales.find((x) => x.id === s.sucursalId)?.codigo,
            estado.sectores?.find((sector) => sector.id === s.sectorId)?.codigo ?? '',
            s.diasCredito ? `${s.diasCredito} días` : 'Contado',
          ],
        }))}
      />
      <Modal titulo={form?.id ? 'Editar socio' : 'Nuevo socio'} abierto={Boolean(form)} onCerrar={() => setForm(null)} ancho="max-w-3xl">
        {form && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={guardar}>
            <Campo etiqueta="Razón social o nombre"><Texto value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></Campo>
            <Campo etiqueta="Nombre comercial"><Texto value={form.nombreComercial} onChange={(e) => setForm({ ...form, nombreComercial: e.target.value })} /></Campo>
            <Campo etiqueta="NIT o CF"><Texto value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} required /></Campo>
            <Campo etiqueta="Sector">
              <Lista value={form.sectorId ?? ''} onChange={(e) => {
                const sector = estado.sectores?.find((item) => item.id === e.target.value)
                setForm({ ...form, sectorId: e.target.value, sucursalId: sector?.sucursalId ?? form.sucursalId })
              }}>
                <option value="">Sin sector</option>
                {(estado.sectores ?? []).filter((sector) => sector.activo && permitidas.includes(sector.sucursalId)).map((sector) => <option key={sector.id} value={sector.id}>{sector.codigo} · {sector.nombre}</option>)}
              </Lista>
            </Campo>
            <Campo etiqueta="Sucursal">
              <Lista value={form.sucursalId} onChange={(e) => setForm({ ...form, sucursalId: e.target.value, sectorId: '' })}>
                {estado.sucursales.filter((s) => permitidas.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Lista>
            </Campo>
            <p className="text-xs text-slate-500 sm:col-span-2">La sucursal sigue al sector. Si cambiás la sucursal, volvé a elegir el sector de esa tienda.</p>
            <div className="sm:col-span-2">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Roles</span>
              <div className="flex gap-2">
                {(['cliente', 'proveedor', 'lead'] as const).map((r) => (
                  <Boton type="button" key={r} variante={form.roles.includes(r) ? 'primario' : 'secundario'} onClick={() => alternar(r)}>{r}</Boton>
                ))}
              </div>
            </div>
            <Campo etiqueta="Teléfono"><Texto value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></Campo>
            <Campo etiqueta="Correo"><Texto value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} /></Campo>
            <Campo etiqueta="Dirección"><Texto value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} /></Campo>
            <Campo etiqueta="Municipio"><Texto value={form.municipio} onChange={(e) => setForm({ ...form, municipio: e.target.value })} /></Campo>
            <Campo etiqueta="Departamento">
              <Lista value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })}>
                {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
              </Lista>
            </Campo>
            <Campo etiqueta="Lista de precios">
              <Lista value={form.listaPrecioId ?? ''} onChange={(e) => setForm({ ...form, listaPrecioId: e.target.value })}>
                {estado.listasPrecio.filter((l) => l.activa).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
              </Lista>
            </Campo>
            <Campo etiqueta="Días de crédito"><Texto type="number" value={form.diasCredito} onChange={(e) => setForm({ ...form, diasCredito: Number(e.target.value) })} /></Campo>
            <Campo etiqueta="Límite de crédito"><Texto type="number" value={form.limiteCredito} onChange={(e) => setForm({ ...form, limiteCredito: Number(e.target.value) })} /></Campo>
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs text-slate-500">Tocá el mapa para fijar la entrega. Lat {form.lat}, lng {form.lng}.</p>
              <SelectorMapa lat={form.lat ?? 0} lng={form.lng ?? 0} onCambio={(p) => setForm({ ...form, lat: p.lat, lng: p.lng })} />
            </div>
            <div className="sm:col-span-2"><Campo etiqueta="Notas"><Area value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></Campo></div>
            <div className="sm:col-span-2"><Boton type="submit">Guardar socio</Boton></div>
          </form>
        )}
      </Modal>
    </Pagina>
  )
}
