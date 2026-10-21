import { useState } from 'react'
import { useErp } from '../datos/store'
import { eliminarRol, guardarRol, guardarUsuario } from '../datos/motor'
import { CATALOGO_OPCIONES, TODAS_LAS_OPCIONES } from '../dominio/permisos'
import type { Rol, Usuario } from '../dominio/tipos'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Tarjeta, Texto } from '../componentes/ui'

type BorradorUsuario = Omit<Usuario, 'id'> & { id?: string }

const vacioUsuario = (rolId: string, sucursalId: string): BorradorUsuario => ({
  nombre: '', correo: '', clave: 'manantial', rolId, sucursalId, telefono: '', activo: true,
})

export function Seguridad() {
  const { estado, sucursalActiva, puede, ejecutar } = useErp()
  const [pestana, setPestana] = useState<'roles' | 'usuarios'>('roles')
  const [rolId, setRolId] = useState(estado.roles[0]?.id ?? '')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [usuario, setUsuario] = useState<BorradorUsuario | null>(null)
  const rolGuardado = estado.roles.find((r) => r.id === rolId) ?? estado.roles[0]
  const [rol, setRol] = useState<Rol | undefined>(rolGuardado)
  const modulos = [...new Set(CATALOGO_OPCIONES.map((o) => o.modulo))]
  const editar = puede('seguridad.editar')

  function elegirRol(id: string) {
    setRolId(id)
    setRol(estado.roles.find((r) => r.id === id))
    setPestana('roles')
  }

  function alternar(codigo: string) {
    if (!rol) return
    const opciones = rol.opciones.includes(codigo) ? rol.opciones.filter((o) => o !== codigo) : [...rol.opciones, codigo]
    setRol({ ...rol, opciones })
  }

  function marcarModulo(modulo: string, activar: boolean) {
    if (!rol) return
    const codigos = CATALOGO_OPCIONES.filter((o) => o.modulo === modulo).map((o) => o.codigo)
    const resto = rol.opciones.filter((codigo) => !codigos.includes(codigo))
    setRol({ ...rol, opciones: activar ? [...resto, ...codigos] : resto })
  }

  function guardar() {
    if (!rol) return
    const resultado = ejecutar((actual) => guardarRol(actual, rol.id ? rol : { ...rol, id: undefined }))
    if (resultado.ok && resultado.id) {
      setRolId(resultado.id)
      const fresco = resultado.estado?.roles.find((r) => r.id === resultado.id)
      if (fresco) setRol(fresco)
    }
  }

  function eliminar() {
    if (!rol?.id) return
    const resultado = ejecutar((actual) => eliminarRol(actual, rol.id))
    if (resultado.ok) {
      const siguiente = resultado.estado?.roles[0]
      setRolId(siguiente?.id ?? '')
      setRol(siguiente)
    }
  }

  const personas = estado.usuarios.filter((u) => u.rolId === rol?.id && (sucursalActiva === 'todas' || u.sucursalId === sucursalActiva))
  const usuarios = estado.usuarios.filter((u) => {
    if (sucursalActiva !== 'todas' && u.sucursalId !== sucursalActiva) return false
    if (filtroRol !== 'todos' && u.rolId !== filtroRol) return false
    const texto = `${u.nombre} ${u.correo}`.toLowerCase()
    return texto.includes(busqueda.toLowerCase())
  })

  return (
    <Pagina
      titulo="Roles y usuarios"
      detalle="El rol dice qué pantallas se abren. El usuario solo elige rol y sucursal."
      accion={editar && (pestana === 'roles'
        ? <Boton onClick={() => { setRolId(''); setRol({ id: '', nombre: '', descripcion: '', alcance: 'sucursal', esRepartidor: false, sistema: false, opciones: ['dashboard.ver'] }) }}>Nuevo rol</Boton>
        : <Boton onClick={() => setUsuario(vacioUsuario(estado.roles[0]?.id ?? '', estado.sucursales[0]?.id ?? ''))}>Nuevo usuario</Boton>)}
    >
      <div className="flex gap-2">
        <Boton variante={pestana === 'roles' ? 'primario' : 'secundario'} onClick={() => setPestana('roles')}>Roles</Boton>
        <Boton variante={pestana === 'usuarios' ? 'primario' : 'secundario'} onClick={() => setPestana('usuarios')}>Usuarios</Boton>
      </div>

      {pestana === 'roles' && (
        <div className="grid items-start gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-2 lg:sticky lg:top-3">
            {estado.roles.map((item) => {
              const cantidad = estado.usuarios.filter((u) => u.rolId === item.id && (sucursalActiva === 'todas' || u.sucursalId === sucursalActiva)).length
              const activo = item.id === rol?.id
              return (
                <button key={item.id} className={`w-full rounded px-3 py-2 text-left text-sm ${activo ? 'bg-[#083844] text-white' : 'bg-white'}`} onClick={() => elegirRol(item.id)}>
                  <div className="font-medium">{item.nombre}</div>
                  <div className={activo ? 'text-cyan-100' : 'text-slate-500'}>{item.opciones.length} {item.opciones.length === 1 ? 'opción' : 'opciones'} · {cantidad} {cantidad === 1 ? 'usuario' : 'usuarios'}</div>
                </button>
              )
            })}
          </div>
          {rol && (
            <Tarjeta className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl">{rol.nombre || 'Nuevo rol'}</h2>
                    {rol.sistema && <Badge>Sistema</Badge>}
                    {rol.esRepartidor && <Badge tono="agua">Handheld</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{rol.opciones.length} {rol.opciones.length === 1 ? 'opción' : 'opciones'} · {personas.length} {personas.length === 1 ? 'usuario' : 'usuarios'}</p>
                </div>
                {editar && (
                  <div className="flex gap-2">
                    <Boton onClick={guardar}>Guardar rol</Boton>
                    {!rol.sistema && rol.id && <Boton variante="peligro" onClick={eliminar}>Eliminar</Boton>}
                  </div>
                )}
              </div>
              {editar && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Campo etiqueta="Nombre"><Texto value={rol.nombre} onChange={(e) => setRol({ ...rol, nombre: e.target.value })} /></Campo>
                  <Campo etiqueta="Descripción"><Texto value={rol.descripcion} onChange={(e) => setRol({ ...rol, descripcion: e.target.value })} /></Campo>
                  <Campo etiqueta="Alcance">
                    <Lista value={rol.esRepartidor ? 'sucursal' : rol.alcance} disabled={rol.esRepartidor} onChange={(e) => setRol({ ...rol, alcance: e.target.value as Rol['alcance'] })}>
                      <option value="empresa">Toda la empresa</option>
                      <option value="sucursal">Solo su sucursal</option>
                    </Lista>
                  </Campo>
                  <label className="mt-6 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={rol.esRepartidor} onChange={(e) => setRol({ ...rol, esRepartidor: e.target.checked, alcance: e.target.checked ? 'sucursal' : rol.alcance })} />
                    Entra solo a la handheld
                  </label>
                </div>
              )}
              {personas.length > 0 && (
                <p className="text-sm text-slate-600">
                  Lo usan {personas.map((u) => u.nombre).join(', ')}.{' '}
                  <button className="font-semibold text-[#0b3a4a]" onClick={() => { setFiltroRol(rol.id); setPestana('usuarios') }}>Ver en usuarios</button>
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Opciones</h3>
                {editar && (
                  <div className="flex gap-2">
                    <Boton variante="secundario" onClick={() => setRol({ ...rol, opciones: [...TODAS_LAS_OPCIONES] })}>Marcar todas</Boton>
                    <Boton variante="secundario" onClick={() => setRol({ ...rol, esRepartidor: true, alcance: 'sucursal', opciones: ['reparto.operar'] })}>Solo handheld</Boton>
                  </div>
                )}
              </div>
              <div className="max-h-[28rem] space-y-3 overflow-auto pr-1">
                {modulos.map((modulo) => {
                  const opciones = CATALOGO_OPCIONES.filter((o) => o.modulo === modulo)
                  const todas = opciones.every((o) => rol.opciones.includes(o.codigo))
                  return (
                    <div key={modulo}>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{modulo}</h3>
                        {editar && (
                          <label className="flex items-center gap-2 text-xs font-semibold text-[#0b3a4a]">
                            <input type="checkbox" checked={todas} onChange={() => marcarModulo(modulo, !todas)} />
                            Todas
                          </label>
                        )}
                      </div>
                      <div className="mt-1 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
                        {opciones.map((opcion) => (
                          <label key={opcion.codigo} className="flex items-center gap-2 rounded bg-[#f7f9fa] px-2 py-1.5 text-sm">
                            <input type="checkbox" disabled={!editar} checked={rol.opciones.includes(opcion.codigo)} onChange={() => alternar(opcion.codigo)} />
                            {opcion.nombre}
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Tarjeta>
          )}
        </div>
      )}

      {pestana === 'usuarios' && (
        <>
          <Tarjeta className="flex flex-wrap gap-2">
            <Texto placeholder="Buscar nombre o correo" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-xs" />
            <Lista value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)} className="max-w-xs">
              <option value="todos">Todos los roles</option>
              {estado.roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </Lista>
          </Tarjeta>
          <Tabla
            id="usuarios"
            columnas={['Nombre', 'Correo', 'Rol', 'Sucursal', 'Estado', 'Acciones']}
            vacio="No hay usuarios con ese filtro."
            filas={usuarios.map((u) => ({
              id: u.id,
              onClick: editar ? () => setUsuario(u) : undefined,
              celdas: [
                u.nombre,
                u.correo,
                <button key="r" className="text-left font-medium text-[#0b3a4a]" onClick={(e) => { e.stopPropagation(); elegirRol(u.rolId) }}>{estado.roles.find((r) => r.id === u.rolId)?.nombre}</button>,
                estado.sucursales.find((s) => s.id === u.sucursalId)?.codigo,
                <Badge key="e" tono={u.activo ? 'ok' : 'neutro'}>{u.activo ? 'Activo' : 'Inactivo'}</Badge>,
                editar ? <Boton key="a" variante="secundario" onClick={(e) => { e.stopPropagation(); setUsuario(u) }}>Editar</Boton> : '',
              ],
            }))}
          />
        </>
      )}

      <Modal titulo={usuario?.id ? 'Editar usuario' : 'Nuevo usuario'} abierto={Boolean(usuario)} onCerrar={() => setUsuario(null)}>
        {usuario && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault()
            const resultado = ejecutar((actual) => guardarUsuario(actual, usuario))
            if (resultado.ok) setUsuario(null)
          }}>
            <Campo etiqueta="Nombre"><Texto value={usuario.nombre} onChange={(e) => setUsuario({ ...usuario, nombre: e.target.value })} required /></Campo>
            <Campo etiqueta="Correo"><Texto value={usuario.correo} onChange={(e) => setUsuario({ ...usuario, correo: e.target.value })} required /></Campo>
            <Campo etiqueta="Rol">
              <Lista value={usuario.rolId} onChange={(e) => setUsuario({ ...usuario, rolId: e.target.value })}>
                {estado.roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </Lista>
            </Campo>
            <Campo etiqueta="Sucursal">
              <Lista value={usuario.sucursalId} onChange={(e) => setUsuario({ ...usuario, sucursalId: e.target.value })}>
                {estado.sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Lista>
            </Campo>
            <Campo etiqueta="Teléfono"><Texto value={usuario.telefono} onChange={(e) => setUsuario({ ...usuario, telefono: e.target.value })} /></Campo>
            <Campo etiqueta="Clave"><Texto value={usuario.clave} onChange={(e) => setUsuario({ ...usuario, clave: e.target.value })} /></Campo>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={usuario.activo} onChange={(e) => setUsuario({ ...usuario, activo: e.target.checked })} /> Puede entrar</label>
            <div className="sm:col-span-2"><Boton type="submit">Guardar usuario</Boton></div>
          </form>
        )}
      </Modal>
    </Pagina>
  )
}
