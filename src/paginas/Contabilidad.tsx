import { useMemo, useState } from 'react'
import { useErp } from '../datos/store'
import { asientoManual } from '../datos/motor'
import { redondear } from '../dominio/calculos'
import { fechaGT, formatoFecha, quetzales } from '../dominio/formato'
import type { LineaAsiento } from '../dominio/tipos'
import { Boton, Campo, Lista, Pagina, Tabla, Tarjeta, Texto } from '../componentes/ui'

type Pestana = 'diario' | 'mayor' | 'balanza' | 'resultados' | 'balance' | 'nuevo'

export function Contabilidad() {
  const { estado, sucursalActiva, puede, ejecutar } = useErp()
  const [pestana, setPestana] = useState<Pestana>('diario')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [cuentaId, setCuentaId] = useState('1201')
  const [descripcion, setDescripcion] = useState('')
  const [lineas, setLineas] = useState<LineaAsiento[]>([
    { cuentaId: '6102', detalle: '', debe: 0, haber: 0 },
    { cuentaId: '1102', detalle: '', debe: 0, haber: 0 },
  ])

  const asientos = useMemo(() => estado.asientos.filter((a) => {
    if (sucursalActiva !== 'todas' && a.sucursalId !== sucursalActiva) return false
    if (desde && a.fecha < desde) return false
    if (hasta && a.fecha > hasta) return false
    return true
  }), [estado.asientos, sucursalActiva, desde, hasta])

  const balanza = useMemo(() => estado.cuentas.map((cuenta) => {
    let debe = 0
    let haber = 0
    for (const asiento of asientos) for (const linea of asiento.lineas) if (linea.cuentaId === cuenta.id) { debe += linea.debe; haber += linea.haber }
    const saldo = redondear(debe - haber)
    return { cuenta, debe: redondear(debe), haber: redondear(haber), deudor: saldo > 0 ? saldo : 0, acreedor: saldo < 0 ? -saldo : 0 }
  }), [estado.cuentas, asientos])

  const ingreso = balanza.filter((b) => b.cuenta.tipo === 'ingreso').reduce((s, b) => s + b.haber - b.debe, 0)
  const costo = balanza.filter((b) => b.cuenta.tipo === 'costo').reduce((s, b) => s + b.debe - b.haber, 0)
  const gasto = balanza.filter((b) => b.cuenta.tipo === 'gasto').reduce((s, b) => s + b.debe - b.haber, 0)
  const resultado = redondear(ingreso - costo - gasto)
  const codigoSucursal = (id: string) => estado.sucursales.find((s) => s.id === id)?.codigo ?? ''
  const mayor = asientos.flatMap((a) => a.lineas.filter((l) => l.cuentaId === cuentaId).map((l) => ({ ...l, fecha: a.fecha, numero: a.numero, descripcion: a.descripcion, sucursal: codigoSucursal(a.sucursalId) })))
  function resumir(lista: typeof asientos) {
    let ingresoSucursal = 0
    let costoSucursal = 0
    let gastoSucursal = 0
    for (const asiento of lista) for (const linea of asiento.lineas) {
      const tipo = estado.cuentas.find((c) => c.id === linea.cuentaId)?.tipo
      if (tipo === 'ingreso') ingresoSucursal += linea.haber - linea.debe
      else if (tipo === 'costo') costoSucursal += linea.debe - linea.haber
      else if (tipo === 'gasto') gastoSucursal += linea.debe - linea.haber
    }
    return { ingreso: redondear(ingresoSucursal), costo: redondear(costoSucursal), gasto: redondear(gastoSucursal), resultado: redondear(ingresoSucursal - costoSucursal - gastoSucursal) }
  }
  const filasDiario = asientos.flatMap((asiento) => asiento.lineas.map((linea, indice) => {
    const cuenta = estado.cuentas.find((c) => c.id === linea.cuentaId)
    return {
      id: `${asiento.id}-${indice}`,
      celdas: [
        indice === 0 ? formatoFecha(asiento.fecha) : '',
        indice === 0 ? codigoSucursal(asiento.sucursalId) : '',
        indice === 0 ? String(asiento.numero) : '',
        indice === 0 ? asiento.descripcion : '',
        `${cuenta?.codigo ?? ''} ${cuenta?.nombre ?? linea.cuentaId}`,
        linea.debe ? quetzales(linea.debe) : '',
        linea.haber ? quetzales(linea.haber) : '',
      ],
    }
  }))
  const sumaDebe = redondear(asientos.reduce((s, a) => s + a.lineas.reduce((t, l) => t + l.debe, 0), 0))
  const sumaHaber = redondear(asientos.reduce((s, a) => s + a.lineas.reduce((t, l) => t + l.haber, 0), 0))

  function filasGrupo(tipo: 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'costo' | 'gasto') {
    return balanza.filter((b) => b.cuenta.tipo === tipo && (b.debe || b.haber)).map((b) => {
      const saldo = tipo === 'activo' || tipo === 'costo' || tipo === 'gasto' ? b.deudor - b.acreedor : b.acreedor - b.deudor
      return { id: b.cuenta.id, nombre: `${b.cuenta.codigo} ${b.cuenta.nombre}`, saldo: redondear(saldo) }
    })
  }
  const activos = filasGrupo('activo')
  const pasivos = filasGrupo('pasivo')
  const patrimonio = filasGrupo('patrimonio')
  const totalActivo = redondear(activos.reduce((s, f) => s + f.saldo, 0))
  const totalPasivo = redondear(pasivos.reduce((s, f) => s + f.saldo, 0))
  const totalPatrimonio = redondear(patrimonio.reduce((s, f) => s + f.saldo, 0) + resultado)

  return (
    <Pagina titulo="Contabilidad" detalle={sucursalActiva === 'todas' ? 'Vista general: junta los asientos de todas las sucursales y, en resultados, los parte por tienda.' : `Vista de ${estado.sucursales.find((s) => s.id === sucursalActiva)?.nombre ?? 'la sucursal'}. Los libros usan solo sus asientos.`}>
      <div className="flex flex-wrap gap-2">
        {([['diario', 'Libro diario'], ['mayor', 'Mayor'], ['balanza', 'Balanza'], ['resultados', 'Resultados'], ['balance', 'Balance general'], ['nuevo', 'Asiento']] as const).map(([id, nombre]) => (
          <Boton key={id} variante={pestana === id ? 'primario' : 'secundario'} onClick={() => setPestana(id)}>{nombre}</Boton>
        ))}
      </div>
      {pestana !== 'nuevo' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
          <Campo etiqueta="Desde"><Texto type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
          <Campo etiqueta="Hasta"><Texto type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
        </div>
      )}
      {pestana === 'diario' && (
        <div className="space-y-3">
          <Tabla
            columnas={['Fecha', 'Sucursal', 'No.', 'Descripción', 'Cuenta', 'Debe', 'Haber']}
            vacio="No hay asientos en este periodo."
            filas={[
              ...filasDiario,
              { id: 'tot', celdas: ['', '', '', `${asientos.length} asientos`, 'Sumas iguales', quetzales(sumaDebe), quetzales(sumaHaber)] },
            ]}
          />
        </div>
      )}
      {pestana === 'mayor' && (
        <Tarjeta className="space-y-3">
          <Campo etiqueta="Cuenta">
            <Lista value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              {estado.cuentas.map((c) => <option key={c.id} value={c.id}>{c.codigo} {c.nombre}</option>)}
            </Lista>
          </Campo>
          <Tabla columnas={['Asiento', 'Fecha', 'Sucursal', 'Descripción', 'Debe', 'Haber']} vacio="Esta cuenta no tiene movimientos en el periodo." filas={mayor.map((l, i) => ({ id: String(i), celdas: [l.numero, formatoFecha(l.fecha), l.sucursal, l.descripcion, l.debe ? quetzales(l.debe) : '', l.haber ? quetzales(l.haber) : ''] }))} />
        </Tarjeta>
      )}
      {pestana === 'balanza' && (
        <Tabla columnas={['Cuenta', 'Debe', 'Haber', 'Deudor', 'Acreedor']} vacio="" filas={[
          ...balanza.filter((b) => b.debe || b.haber).map((b) => ({ id: b.cuenta.id, celdas: [`${b.cuenta.codigo} ${b.cuenta.nombre}`, quetzales(b.debe), quetzales(b.haber), b.deudor ? quetzales(b.deudor) : '', b.acreedor ? quetzales(b.acreedor) : ''] })),
          { id: 'tot', celdas: ['Sumas', quetzales(balanza.reduce((s, b) => s + b.debe, 0)), quetzales(balanza.reduce((s, b) => s + b.haber, 0)), quetzales(balanza.reduce((s, b) => s + b.deudor, 0)), quetzales(balanza.reduce((s, b) => s + b.acreedor, 0))] },
        ]} />
      )}
      {pestana === 'resultados' && (
        <div className="space-y-3">
        {sucursalActiva === 'todas' && (
          <Tabla
            id="resultado-sucursal"
            columnas={['Sucursal', 'Ingresos', 'Costos', 'Gastos', 'Resultado']}
            vacio="No hay sucursales."
            filas={[
              ...estado.sucursales.map((sucursal) => {
                const corte = resumir(asientos.filter((a) => a.sucursalId === sucursal.id))
                return { id: sucursal.id, celdas: [sucursal.nombre, quetzales(corte.ingreso), quetzales(corte.costo), quetzales(corte.gasto), quetzales(corte.resultado)] }
              }),
              { id: 'general', celdas: ['General', quetzales(ingreso), quetzales(costo), quetzales(gasto), quetzales(resultado)] },
            ]}
          />
        )}
        <Tarjeta className="max-w-lg space-y-2 text-sm">
          <h2 className="font-display text-2xl">Estado de resultados</h2>
          <p className="text-slate-500">{desde || 'Inicio'} — {hasta || 'hoy'}</p>
          {filasGrupo('ingreso').map((f) => <div key={f.id} className="flex justify-between"><span>{f.nombre}</span><span>{quetzales(f.saldo)}</span></div>)}
          <div className="flex justify-between font-medium"><span>Ingresos</span><strong>{quetzales(ingreso)}</strong></div>
          {filasGrupo('costo').map((f) => <div key={f.id} className="flex justify-between"><span>{f.nombre}</span><span>{quetzales(f.saldo)}</span></div>)}
          {filasGrupo('gasto').map((f) => <div key={f.id} className="flex justify-between"><span>{f.nombre}</span><span>{quetzales(f.saldo)}</span></div>)}
          <div className="flex justify-between border-t border-slate-200 pt-2 font-display text-2xl"><span>Resultado del periodo</span><span>{quetzales(resultado)}</span></div>
        </Tarjeta>
        </div>
      )}
      {pestana === 'balance' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Tarjeta className="space-y-2 text-sm">
            <h2 className="font-display text-2xl">Activo</h2>
            {activos.map((f) => <div key={f.id} className="flex justify-between"><span>{f.nombre}</span><span>{quetzales(f.saldo)}</span></div>)}
            <div className="flex justify-between border-t border-slate-200 pt-2 font-medium"><span>Total activo</span><strong>{quetzales(totalActivo)}</strong></div>
          </Tarjeta>
          <Tarjeta className="space-y-2 text-sm">
            <h2 className="font-display text-2xl">Pasivo y patrimonio</h2>
            {pasivos.map((f) => <div key={f.id} className="flex justify-between"><span>{f.nombre}</span><span>{quetzales(f.saldo)}</span></div>)}
            {patrimonio.map((f) => <div key={f.id} className="flex justify-between"><span>{f.nombre}</span><span>{quetzales(f.saldo)}</span></div>)}
            <div className="flex justify-between"><span>Resultado del periodo</span><span>{quetzales(resultado)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-medium"><span>Total pasivo y patrimonio</span><strong>{quetzales(redondear(totalPasivo + totalPatrimonio))}</strong></div>
          </Tarjeta>
        </div>
      )}
      {pestana === 'nuevo' && (
        <Tarjeta>
          {puede('contabilidad.editar') ? (
            <form className="space-y-3" onSubmit={(e) => {
              e.preventDefault()
              const resultadoAsiento = ejecutar((actual) => asientoManual(actual, { fecha: fechaGT(), sucursalId: sucursalActiva === 'todas' ? 'suc-z10' : sucursalActiva, descripcion, lineas }))
              if (resultadoAsiento.ok) setDescripcion('')
            }}>
              <Campo etiqueta="Descripción"><Texto value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></Campo>
              {lineas.map((linea, indice) => (
                <div key={indice} className="grid grid-cols-[1.4fr_100px_100px] gap-2">
                  <Lista value={linea.cuentaId} onChange={(e) => setLineas(lineas.map((l, i) => i === indice ? { ...l, cuentaId: e.target.value } : l))}>
                    {estado.cuentas.map((c) => <option key={c.id} value={c.id}>{c.codigo} {c.nombre}</option>)}
                  </Lista>
                  <Texto type="number" step="0.01" placeholder="Debe" value={linea.debe || ''} onChange={(e) => setLineas(lineas.map((l, i) => i === indice ? { ...l, debe: Number(e.target.value) } : l))} />
                  <Texto type="number" step="0.01" placeholder="Haber" value={linea.haber || ''} onChange={(e) => setLineas(lineas.map((l, i) => i === indice ? { ...l, haber: Number(e.target.value) } : l))} />
                </div>
              ))}
              <Boton type="button" variante="secundario" onClick={() => setLineas([...lineas, { cuentaId: '1101', detalle: '', debe: 0, haber: 0 }])}>Agregar línea</Boton>
              <div className="text-sm">Diferencia {quetzales(lineas.reduce((s, l) => s + l.debe - l.haber, 0))}</div>
              <Boton type="submit">Registrar en el diario</Boton>
            </form>
          ) : <p className="text-sm text-slate-600">Tu rol puede consultar los libros. Registrar asientos está en otra opción.</p>}
        </Tarjeta>
      )}
    </Pagina>
  )
}
