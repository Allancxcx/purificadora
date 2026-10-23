import { useState } from 'react'
import { useErp } from '../datos/store'
import { guardarSector } from '../datos/motor'
import { codigoSector } from '../datos/consultas'
import { DEPARTAMENTOS_GT, MUNICIPIOS_GT, lugarDe, municipiosDelDepartamento } from '../dominio/geografia'
import { Buscador } from '../componentes/Buscador'
import { Badge, Boton, Campo, Modal, Pagina, Tabla, Tarjeta, Texto } from '../componentes/ui'

const vacio = (sucursalId: string) => ({
  departamentoCodigo: '01',
  municipioCodigo: '01',
  sector: '1',
  nombre: '',
  sucursalId,
  activa: true,
})

function codigoMunicipio(departamentoCodigo: string, municipioCodigo: string) {
  if (departamentoCodigo.length !== 2) return ''
  const codigo = `${departamentoCodigo}${municipioCodigo.padStart(2, '0')}`
  return MUNICIPIOS_GT.some((item) => item.codigo === codigo) ? codigo : ''
}

export function Sectores() {
  const { estado, permitidas, sede, enVista, puede, ejecutar } = useErp()
  const [q, setQ] = useState('')
  const [form, setForm] = useState<(ReturnType<typeof vacio> & { id?: string }) | null>(null)
  const sectores = (estado.sectores ?? []).filter((sector) => {
    if (!enVista(sector.sucursalId)) return false
    const lugar = lugarDe(sector.departamentoCodigo, sector.municipioCodigo)
    const texto = `${sector.codigo} ${sector.nombre} ${lugar.departamento} ${lugar.municipio}`.toLowerCase()
    return texto.includes(q.trim().toLowerCase())
  })
  const codigo = form ? codigoSector(form.departamentoCodigo, form.municipioCodigo, form.sector) : ''
  const departamentoConocido = DEPARTAMENTOS_GT.some((item) => item.codigo === form?.departamentoCodigo)
  const municipios = form ? (departamentoConocido ? municipiosDelDepartamento(form.departamentoCodigo) : MUNICIPIOS_GT) : []
  const municipioElegido = form ? codigoMunicipio(form.departamentoCodigo, form.municipioCodigo) : ''

  function aplicarMunicipio(codigoMuni: string, actual: NonNullable<typeof form>) {
    const municipio = MUNICIPIOS_GT.find((item) => item.codigo === codigoMuni)
    if (!municipio) return
    const sugerido = `${municipio.nombre} sector ${actual.sector}`
    const nombreVacio = actual.nombre.trim().length === 0
    const eraSugerido = MUNICIPIOS_GT.some((item) => actual.nombre === `${item.nombre} sector ${actual.sector}`)
    setForm({
      ...actual,
      departamentoCodigo: municipio.departamento,
      municipioCodigo: municipio.codigo.slice(2),
      nombre: nombreVacio || eraSugerido ? sugerido : actual.nombre,
      sucursalId: actual.sucursalId,
    })
  }

  return (
    <Pagina titulo="Sectorización" detalle="Los códigos son los administrativos: el departamento 01 es Guatemala y el municipio 0108 es Mixco. El sector de reparto se agrega al final, así 01 + 08 + 1 arma 01081." accion={puede('sucursales.editar') && <Boton onClick={() => setForm(vacio(sede))}>Nuevo sector</Boton>}>
      <Tarjeta>
        <Texto placeholder="Buscar código, nombre o municipio" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      </Tarjeta>
      <Tabla
        id="sectores"
        columnas={['Código', 'Nombre', 'Departamento', 'Municipio', 'Sector', 'Sucursal', 'Estado']}
        vacio="No hay sectores con esa búsqueda."
        filas={sectores.map((sector) => ({
          id: sector.id,
          onClick: puede('sucursales.editar') ? () => setForm({ ...sector, activa: sector.activo }) : undefined,
          celdas: [
            sector.codigo,
            sector.nombre,
            lugarDe(sector.departamentoCodigo, sector.municipioCodigo).departamento,
            lugarDe(sector.departamentoCodigo, sector.municipioCodigo).municipio,
            sector.sector,
            estado.sucursales.find((s) => s.id === sector.sucursalId)?.codigo ?? '',
            <Badge key="e" tono={sector.activo ? 'ok' : 'neutro'}>{sector.activo ? 'Activo' : 'Inactivo'}</Badge>,
          ],
        }))}
      />
      <Modal titulo={form?.id ? 'Editar sector' : 'Nuevo sector'} abierto={Boolean(form)} onCerrar={() => setForm(null)}>
        {form && (
          <form className="space-y-3" onSubmit={(event) => {
            event.preventDefault()
            const resultado = ejecutar((actual) => guardarSector(actual, { ...form, activo: form.activa }))
            if (resultado.ok) setForm(null)
          }}>
            <Campo etiqueta="Departamento">
              <Buscador
                opciones={DEPARTAMENTOS_GT.map((item) => ({ value: item.codigo, etiqueta: `${item.codigo} · ${item.nombre}` }))}
                value={departamentoConocido ? form.departamentoCodigo : ''}
                onChange={(departamentoCodigo) => setForm({ ...form, departamentoCodigo, municipioCodigo: '' })}
                placeholder="Nombre o código del departamento"
              />
            </Campo>
            <Campo etiqueta="Municipio">
              <Buscador
                opciones={municipios.map((item) => ({ value: item.codigo, etiqueta: `${item.codigo} · ${item.nombre}` }))}
                value={municipioElegido}
                onChange={(codigoMuni) => aplicarMunicipio(codigoMuni, form)}
                placeholder="Nombre o código del municipio"
              />
            </Campo>
            <Campo etiqueta="Sector"><Texto value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} required /></Campo>
            <p className="text-sm text-slate-500">Código {codigo || '—'}. {departamentoConocido ? 'Departamento y municipio salen del catálogo administrativo.' : `Este sector conserva el territorio ${form.departamentoCodigo} / ${form.municipioCodigo}. Elegí un municipio del catálogo para usar el código publicado.`}</p>
            <Campo etiqueta="Nombre"><Texto value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></Campo>
            <Campo etiqueta="Sucursal">
              <Buscador
                opciones={estado.sucursales.filter((s) => permitidas.includes(s.id)).map((s) => ({ value: s.id, etiqueta: s.nombre }))}
                value={form.sucursalId}
                onChange={(sucursalId) => setForm({ ...form, sucursalId })}
                placeholder="Sucursal"
              />
            </Campo>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} /> Activo</label>
            <Boton type="submit">Guardar</Boton>
          </form>
        )}
      </Modal>
    </Pagina>
  )
}
