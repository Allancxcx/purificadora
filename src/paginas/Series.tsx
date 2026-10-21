import { useState } from 'react'
import { useErp } from '../datos/store'
import { guardarSerie } from '../datos/motor'
import { ETIQUETA_SERIE } from '../dominio/permisos'
import type { SerieDocumento, TipoSerie } from '../dominio/tipos'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Texto } from '../componentes/ui'

const TIPOS: TipoSerie[] = ['ORDEN_VENTA', 'ORDEN_COMPRA', 'FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'RECIBO']

export function Series() {
  const { estado, sucursalActiva, puede, ejecutar } = useErp()
  const [form, setForm] = useState<(Omit<SerieDocumento, 'id'> & { id?: string }) | null>(null)
  const series = estado.series.filter((s) => sucursalActiva === 'todas' || s.sucursalId === sucursalActiva)
  return (
    <Pagina titulo="Series de documentos" detalle="Una serie activa por tipo y sucursal. Factura, nota de crédito y nota de débito consumen el número solo cuando el certificador acepta." accion={puede('series.editar') && <Boton onClick={() => setForm({ sucursalId: sucursalActiva === 'todas' ? 'suc-z10' : sucursalActiva, tipo: 'FACTURA', prefijo: '', serieFel: 'A', resolucion: 'Control interno', correlativo: 1, hasta: 999999, activa: false })}>Nueva serie</Boton>}>
      <Tabla
        columnas={['Sucursal', 'Tipo', 'Prefijo', 'Serie FEL', 'Siguiente', 'Hasta', 'Estado']}
        vacio="No hay series."
        filas={series.map((s) => ({
          id: s.id,
          onClick: puede('series.editar') ? () => setForm(s) : undefined,
          celdas: [
            estado.sucursales.find((x) => x.id === s.sucursalId)?.codigo,
            ETIQUETA_SERIE[s.tipo],
            s.prefijo,
            s.serieFel || '—',
            s.correlativo,
            s.hasta,
            <Badge key="e" tono={s.activa ? 'ok' : 'neutro'}>{s.activa ? 'Activa' : 'Inactiva'}</Badge>,
          ],
        }))}
      />
      <Modal titulo="Serie" abierto={Boolean(form)} onCerrar={() => setForm(null)}>
        {form && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault()
            const resultado = ejecutar((actual) => guardarSerie(actual, form))
            if (resultado.ok) setForm(null)
          }}>
            <Campo etiqueta="Sucursal">
              <Lista value={form.sucursalId} onChange={(e) => setForm({ ...form, sucursalId: e.target.value })}>
                {estado.sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Lista>
            </Campo>
            <Campo etiqueta="Tipo">
              <Lista value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoSerie })}>
                {TIPOS.map((t) => <option key={t} value={t}>{ETIQUETA_SERIE[t]}</option>)}
              </Lista>
            </Campo>
            <Campo etiqueta="Prefijo interno"><Texto value={form.prefijo} onChange={(e) => setForm({ ...form, prefijo: e.target.value.toUpperCase() })} /></Campo>
            <Campo etiqueta="Serie FEL"><Texto value={form.serieFel} onChange={(e) => setForm({ ...form, serieFel: e.target.value.toUpperCase() })} /></Campo>
            <Campo etiqueta="Siguiente número"><Texto type="number" value={form.correlativo} onChange={(e) => setForm({ ...form, correlativo: Number(e.target.value) })} /></Campo>
            <Campo etiqueta="Hasta"><Texto type="number" value={form.hasta} onChange={(e) => setForm({ ...form, hasta: Number(e.target.value) })} /></Campo>
            <div className="sm:col-span-2"><Campo etiqueta="Referencia interna"><Texto value={form.resolucion} onChange={(e) => setForm({ ...form, resolucion: e.target.value })} /></Campo></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} /> Activa</label>
            <div className="sm:col-span-2"><Boton type="submit">Guardar serie</Boton></div>
          </form>
        )}
      </Modal>
    </Pagina>
  )
}
