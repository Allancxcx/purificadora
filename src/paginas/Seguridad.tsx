import { useState } from 'react'
import { useErp } from '../datos/store'
import { eliminarRol, guardarRol, guardarUsuario } from '../datos/motor'
import { CATALOGO_OPCIONES } from '../dominio/permisos'
import type { Rol, Usuario } from '../dominio/tipos'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tarjeta, Texto } from '../componentes/ui'

export function Seguridad() {
  const { estado, puede, ejecutar } = useErp()
  const [rolId, setRolId] = useState(estado.roles[0]?.id ?? '')
  const [usuario, setUsuario] = useState<(Omit<Usuario, 'id'> & { id?: string }) | null>(null)
  const rolGuardado = estado.roles.find((r) => r.id === rolId) ?? estado.roles[0]
  const [rol, setRol] = useState<Rol | undefined>(rolGuardado)
  const modulos = [...new Set(CATALOGO_OPCIONES.map((o) => o.modulo))]

  function elegirRol(id: string) {
    setRolId(id)
    setRol(estado.roles.find((r) => r.id === id))
  }

  function alternar(codigo: string) {
    if (!rol) return
    const opciones = rol.opciones.includes(codigo) ? rol.opciones.filter((o) => o !== codigo) : [...rol.opciones, codigo]
    setRol({ ...rol, opciones })
  }

  return (
    <Pagina titulo="Roles y usuarios" detalle="Creás el rol y marcás las opciones que puede usar. El repartidor solo tiene la handheld; el resto entra a la oficina." accion={puede('seguridad.editar') && <Boton onClick={() => { const creado = ejecutar((e) => guardarRol(e, { nombre: 'Nuevo rol', descripcion: 'Definí sus opciones', alcance: 'sucursal', esRepartidor: false, opciones: ['dashboard.ver'] })); if (creado.ok && creado.id) { setRolId(creado.id); setRol(creado.estado.roles.find((r) => r.id === creado.id)) } }}>Nuevo rol</Boton>}>
      <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          {estado.roles.map((item) => (
            <button key={item.id} className={`w-full rounded-2xl px-3 py-2 text-left text-sm ${item.id === rol?.id ? 'bg-[#083844] text-white' : 'bg-white'}`} onClick={() => elegirRol(item.id)}>
              <div className="font-medium">{item.nombre}</div>
              <div className={item.id === rol?.id ? 'text-cyan-100' : 'text-slate-500'}>{item.alcance}</div>
            </button>
          ))}
        </div>
        {rol && (
          <Tarjeta className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl">{rol.nombre}</h2>
              {rol.sistema && <Badge>Sistema</Badge>}
              {rol.esRepartidor && <Badge tono="agua">Handheld</Badge>}
            </div>
            {puede('seguridad.editar') && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Campo etiqueta="Nombre"><Texto value={rol.nombre} onChange={(e) => setRol({ ...rol, nombre: e.target.value })} /></Campo>
                <Campo etiqueta="Descripción"><Texto value={rol.descripcion} onChange={(e) => setRol({ ...rol, descripcion: e.target.value })} /></Campo>
                <Campo etiqueta="Alcance">
                  <Lista value={rol.alcance} onChange={(e) => setRol({ ...rol, alcance: e.target.value as Rol['alcance'] })}>
                    <option value="empresa">Toda la empresa</option>
                    <option value="sucursal">Solo su sucursal</option>
                  </Lista>
                </Campo>
                <label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" checked={rol.esRepartidor} onChange={(e) => setRol({ ...rol, esRepartidor: e.target.checked })} /> Es repartidor</label>
              </div>
            )}
            <p className="text-sm text-slate-600">{rol.descripcion}</p>
            {modulos.map((modulo) => (
              <div key={modulo}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{modulo}</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {CATALOGO_OPCIONES.filter((o) => o.modulo === modulo).map((opcion) => (
                    <label key={opcion.codigo} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <input type="checkbox" disabled={!puede('seguridad.editar')} checked={rol.opciones.includes(opcion.codigo)} onChange={() => alternar(opcion.codigo)} />
                      {opcion.nombre}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {puede('seguridad.editar') && <Boton onClick={() => ejecutar((e) => guardarRol(e, rol))}>Guardar rol</Boton>}
            {puede('seguridad.editar') && !rol.sistema && <Boton variante="peligro" onClick={() => ejecutar((e) => eliminarRol(e, rol.id))}>Eliminar rol</Boton>}
          </Tarjeta>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <h2 className="font-display text-2xl">Usuarios</h2>
        {puede('seguridad.editar') && <Boton onClick={() => setUsuario({ nombre: '', correo: '', clave: 'manantial', rolId: estado.roles[0].id, sucursalId: estado.sucursales[0].id, telefono: '', activo: true })}>Nuevo usuario</Boton>}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {estado.usuarios.map((u) => (
          <Tarjeta key={u.id} className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">{u.nombre}</div>
              <div className="text-sm text-slate-500">{u.correo} · {estado.roles.find((r) => r.id === u.rolId)?.nombre} · {estado.sucursales.find((s) => s.id === u.sucursalId)?.codigo}</div>
            </div>
            {puede('seguridad.editar') && <Boton variante="secundario" onClick={() => setUsuario(u)}>Editar</Boton>}
          </Tarjeta>
        ))}
      </div>
      <Modal titulo="Usuario" abierto={Boolean(usuario)} onCerrar={() => setUsuario(null)}>
        {usuario && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault()
            const resultado = ejecutar((actual) => guardarUsuario(actual, usuario))
            if (resultado.ok) setUsuario(null)
          }}>
            <Campo etiqueta="Nombre"><Texto value={usuario.nombre} onChange={(e) => setUsuario({ ...usuario, nombre: e.target.value })} /></Campo>
            <Campo etiqueta="Correo"><Texto value={usuario.correo} onChange={(e) => setUsuario({ ...usuario, correo: e.target.value })} /></Campo>
            <Campo etiqueta="Clave"><Texto value={usuario.clave} onChange={(e) => setUsuario({ ...usuario, clave: e.target.value })} /></Campo>
            <Campo etiqueta="Teléfono"><Texto value={usuario.telefono} onChange={(e) => setUsuario({ ...usuario, telefono: e.target.value })} /></Campo>
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
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={usuario.activo} onChange={(e) => setUsuario({ ...usuario, activo: e.target.checked })} /> Activo</label>
            <div className="sm:col-span-2"><Boton type="submit">Guardar usuario</Boton></div>
          </form>
        )}
      </Modal>
    </Pagina>
  )
}
