import { useState } from 'react'
import { useErp } from '../datos/store'
import { guardarSector } from '../datos/motor'
import { codigoSector } from '../datos/consultas'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Texto } from '../componentes/ui'

const vacio = (sucursalId: string) => ({
  departamentoCodigo: '02001',
  municipioCodigo: '01',
  sector: '1',
  nombre: '',
  sucursalId,
  activa: true,
})

export function Sectores() {
  const { estado, permitidas, sede, enVista, puede, ejecutar } = useErp()
  const [form, setForm] = useState<(ReturnType<typeof vacio> & { id?: string }) | null>(null)
  const sectores = (estado.sectores ?? []).filter((sector) => enVista(sector.sucursalId))
  const codigo = form ? codigoSector(form.departamentoCodigo, form.municipioCodigo, form.sector) : ''

  return (
    <Pagina titulo="Sectorización" detalle="El código junta departamento, municipio y sector. Con 02001, 01 y 1 queda 0200101. Cada sector pertenece a una sucursal y se asigna en el socio." accion={puede('sucursales.editar') && <Boton onClick={() => setForm(vacio(sede))}>Nuevo sector</Boton>}>
      <Tabla
        id="sectores"
        columnas={['Código', 'Nombre', 'Departamento', 'Municipio', 'Sector', 'Sucursal', 'Estado']}
        vacio="No hay sectores en esta vista."
        filas={sectores.map((sector) => ({
          id: sector.id,
          onClick: puede('sucursales.editar') ? () => setForm({ ...sector, activa: sector.activo }) : undefined,
          celdas: [
            sector.codigo,
            sector.nombre,
            sector.departamentoCodigo,
            sector.municipioCodigo,
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
            <Campo etiqueta="Departamento"><Texto value={form.departamentoCodigo} onChange={(e) => setForm({ ...form, departamentoCodigo: e.target.value })} required /></Campo>
            <Campo etiqueta="Municipio"><Texto value={form.municipioCodigo} onChange={(e) => setForm({ ...form, municipioCodigo: e.target.value })} required /></Campo>
            <Campo etiqueta="Sector"><Texto value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} required /></Campo>
            <p className="text-sm text-slate-500">Código {codigo || '—'}. El ejemplo 02001 + 01 + 1 arma 0200101.</p>
            <Campo etiqueta="Nombre"><Texto value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></Campo>
            <Campo etiqueta="Sucursal">
              <Lista value={form.sucursalId} onChange={(e) => setForm({ ...form, sucursalId: e.target.value })}>
                {estado.sucursales.filter((s) => permitidas.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Lista>
            </Campo>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} /> Activo</label>
            <Boton type="submit">Guardar</Boton>
          </form>
        )}
      </Modal>
    </Pagina>
  )
}
