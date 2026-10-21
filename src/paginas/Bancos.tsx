import { useState } from 'react'
import { useErp } from '../datos/store'
import { guardarCuentaBancaria } from '../datos/motor'
import { saldoBanco } from '../datos/consultas'
import { formatoFecha, quetzales } from '../dominio/formato'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Texto } from '../componentes/ui'

const vacio = (sucursalId: string) => ({
  banco: '',
  nombre: '',
  numero: '',
  sucursalId,
  activa: true,
})

export function Bancos() {
  const { estado, permitidas, sede, enVista, puede, ejecutar } = useErp()
  const [elegida, setElegida] = useState('ban-bi')
  const [form, setForm] = useState<(ReturnType<typeof vacio> & { id?: string }) | null>(null)
  const cuentas = estado.cuentasBancarias.filter((cuenta) => enVista(cuenta.sucursalId))
  const cuenta = cuentas.find((item) => item.id === elegida) ?? cuentas[0]
  const movimientos = estado.asientos.flatMap((asiento) => asiento.lineas.filter((linea) => linea.bancoId === cuenta?.id).map((linea) => ({
    id: `${asiento.id}-${linea.detalle}`,
    fecha: asiento.fecha,
    sucursal: estado.sucursales.find((s) => s.id === asiento.sucursalId)?.codigo ?? '',
    descripcion: asiento.descripcion,
    detalle: linea.detalle,
    entra: linea.debe,
    sale: linea.haber,
  }))).reverse()

  return (
    <Pagina titulo="Bancos" detalle="Cada cuenta opera en quetzales y sus movimientos quedan en el diario, cuenta 1102. El saldo de la ficha es la suma de esos movimientos." accion={puede('bancos.editar') && <Boton onClick={() => setForm(vacio(sede))}>Nueva cuenta</Boton>}>
      <div className="grid gap-3 md:grid-cols-2">
        {cuentas.map((item) => (
          <div key={item.id} role="button" tabIndex={0} onClick={() => setElegida(item.id)} onKeyDown={(e) => { if (e.key === 'Enter') setElegida(item.id) }} className={`rounded-md bg-white p-4 text-left shadow-sm ring-1 ${cuenta?.id === item.id ? 'ring-cyan-700' : 'ring-slate-200'}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.banco}</div>
              <Badge tono={item.activa ? 'ok' : 'neutro'}>{item.activa ? 'Activa' : 'Inactiva'}</Badge>
            </div>
            <div className="mt-1 font-medium">{item.nombre}</div>
            <div className="text-sm text-slate-500">{item.numero} · {estado.sucursales.find((s) => s.id === item.sucursalId)?.codigo}</div>
            <div className="mt-2 text-2xl font-semibold">{quetzales(saldoBanco(estado, item.id))}</div>
            {puede('bancos.editar') && <button type="button" className="mt-2 text-sm text-[#0b3a4a]" onClick={(e) => { e.stopPropagation(); setForm(item) }}>Editar</button>}
          </div>
        ))}
      </div>
      <Tabla
        id="banco-movimientos"
        columnas={['Fecha', 'Sucursal', 'Documento', 'Detalle', 'Entra', 'Sale']}
        vacio="Esta cuenta no tiene movimientos."
        filas={movimientos.map((movimiento, indice) => ({
          id: `${movimiento.id}-${indice}`,
          celdas: [
            formatoFecha(movimiento.fecha),
            movimiento.sucursal,
            movimiento.descripcion,
            movimiento.detalle,
            movimiento.entra ? quetzales(movimiento.entra) : '',
            movimiento.sale ? quetzales(movimiento.sale) : '',
          ],
        }))}
      />
      <Modal titulo={form?.id ? 'Editar cuenta' : 'Nueva cuenta'} abierto={Boolean(form)} onCerrar={() => setForm(null)}>
        {form && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault()
            const resultado = ejecutar((actual) => guardarCuentaBancaria(actual, form))
            if (resultado.ok) setForm(null)
          }}>
            <Campo etiqueta="Banco"><Texto value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} required /></Campo>
            <Campo etiqueta="Nombre de la cuenta"><Texto value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></Campo>
            <Campo etiqueta="Número"><Texto value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} required /></Campo>
            <Campo etiqueta="Sucursal que la opera">
              <Lista value={form.sucursalId} onChange={(e) => setForm({ ...form, sucursalId: e.target.value })}>
                {estado.sucursales.filter((s) => permitidas.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Lista>
            </Campo>
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} /> Activa</label>
            <p className="text-sm text-slate-500 sm:col-span-2">La moneda es quetzales y el asiento usa la cuenta 1102.</p>
            <div className="sm:col-span-2"><Boton type="submit">Guardar cuenta</Boton></div>
          </form>
        )}
      </Modal>
    </Pagina>
  )
}
