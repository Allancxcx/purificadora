import { useState } from 'react'
import { useErp } from '../datos/store'
import { guardarVehiculo } from '../datos/motor'
import { bancosActivos, saldoCuenta } from '../datos/consultas'
import { CTA } from '../dominio/calculos'
import { quetzales } from '../dominio/formato'
import type { Vehiculo } from '../dominio/tipos'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Tarjeta, Texto } from '../componentes/ui'

const ETIQUETA: Record<Vehiculo['estado'], string> = {
  disponible: 'Disponible',
  en_ruta: 'En ruta',
  taller: 'En taller',
  baja: 'De baja',
}

const vacio = (sucursalId: string) => ({
  placa: '',
  nombre: '',
  sucursalId,
  anio: 2024,
  valor: 0,
  bancoId: 'ban-bi',
  estado: 'disponible' as Vehiculo['estado'],
})

export function Activos() {
  const { estado, sucursalActiva, permitidas, sede, enVista, puede, ejecutar } = useErp()
  const [form, setForm] = useState<(ReturnType<typeof vacio> & { id?: string }) | null>(null)
  const sucursalDefault = sede
  const bancos = bancosActivos(estado, permitidas)
  const visibles = estado.vehiculos.filter((v) => enVista(v.sucursalId))
  const valor = visibles.reduce((suma, vehiculo) => suma + vehiculo.valor, 0)
  const contable = saldoCuenta(estado, CTA.flota, sucursalActiva, permitidas)

  function etiqueta(vehiculo: Vehiculo) {
    if (vehiculo.estado !== 'en_ruta') return ETIQUETA[vehiculo.estado]
    const ruta = estado.rutas.find((r) => r.vehiculoId === vehiculo.id && r.estado !== 'finalizada')
    return ruta?.estado === 'planificada' ? 'Asignado' : 'En ruta'
  }

  return (
    <Pagina titulo="Activos" detalle="Los vehículos son activos fijos. El alta entra a la cuenta 1501 y sale de la cuenta bancaria elegida. Esta demostración no deprecia." accion={puede('activos.editar') && <Boton onClick={() => setForm(vacio(sucursalDefault))}>Nuevo vehículo</Boton>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Tarjeta><div className="text-xs uppercase tracking-[0.14em] text-slate-500">Costo de adquisición</div><div className="font-display mt-1 text-3xl">{quetzales(valor)}</div></Tarjeta>
        <Tarjeta><div className="text-xs uppercase tracking-[0.14em] text-slate-500">Cuenta 1501 · {sucursalActiva === 'todas' ? 'General' : estado.sucursales.find((s) => s.id === sucursalActiva)?.codigo}</div><div className="font-display mt-1 text-3xl">{quetzales(contable)}</div></Tarjeta>
      </div>
      <Tabla
        columnas={['Código', 'Vehículo', 'Placa', 'Sucursal', 'Año', 'Valor', 'Estado']}
        vacio="No hay vehículos en esta sucursal."
        filas={visibles.map((vehiculo) => ({
          id: vehiculo.id,
          onClick: puede('activos.editar') ? () => setForm({ ...vehiculo, bancoId: 'ban-bi' }) : undefined,
          celdas: [
            vehiculo.codigo,
            vehiculo.nombre,
            vehiculo.placa,
            estado.sucursales.find((s) => s.id === vehiculo.sucursalId)?.codigo,
            vehiculo.anio,
            quetzales(vehiculo.valor),
            <Badge key="e" tono={vehiculo.estado === 'disponible' ? 'ok' : vehiculo.estado === 'baja' ? 'peligro' : vehiculo.estado === 'taller' ? 'alerta' : 'agua'}>{etiqueta(vehiculo)}</Badge>,
          ],
        }))}
      />
      <Modal titulo={form?.id ? 'Editar vehículo' : 'Nuevo vehículo'} abierto={Boolean(form)} onCerrar={() => setForm(null)}>
        {form && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault()
            const resultado = ejecutar((actual) => guardarVehiculo(actual, form))
            if (resultado.ok) setForm(null)
          }}>
            <Campo etiqueta="Nombre"><Texto value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></Campo>
            <Campo etiqueta="Placa"><Texto value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} required /></Campo>
            <Campo etiqueta="Sucursal">
              <Lista value={form.sucursalId} onChange={(e) => setForm({ ...form, sucursalId: e.target.value })}>
                {estado.sucursales.filter((s) => permitidas.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </Lista>
            </Campo>
            <Campo etiqueta="Año"><Texto type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })} /></Campo>
            {form.id ? (
              <Campo etiqueta="Estado">
                <Lista value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as Vehiculo['estado'] })}>
                  <option value="disponible">Disponible</option>
                  <option value="en_ruta" disabled>En ruta</option>
                  <option value="taller">En taller</option>
                  <option value="baja">De baja</option>
                </Lista>
              </Campo>
            ) : (
              <Campo etiqueta="Valor de adquisición">
                <Texto type="number" step="0.01" min={0} value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
              </Campo>
            )}
            {!form.id && (
              <Campo etiqueta="Cuenta que paga">
                <Lista value={form.bancoId} onChange={(e) => setForm({ ...form, bancoId: e.target.value })}>
                  {bancos.map((b) => <option key={b.id} value={b.id}>{b.banco} · {b.nombre}</option>)}
                </Lista>
              </Campo>
            )}
            {form.id && <p className="text-sm text-slate-500 sm:col-span-2">Valor registrado: {quetzales(form.valor)}. El costo de adquisición no se vuelve a editar.</p>}
            {!form.id && <p className="text-sm text-slate-500 sm:col-span-2">Ese importe se debita en 1501 y sale de la cuenta bancaria elegida. En cero no mueve bancos.</p>}
            <div className="sm:col-span-2"><Boton type="submit">Guardar</Boton></div>
          </form>
        )}
      </Modal>
    </Pagina>
  )
}
