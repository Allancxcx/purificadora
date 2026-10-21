import { useEffect, useState } from 'react'
import { useErp } from '../datos/store'
import { crearRuta, iniciarRuta } from '../datos/motor'
import { folio, kilometrosRuta, ordenDespachable, posicionRepartidor } from '../datos/consultas'
import { distanciaKm } from '../dominio/geo'
import { fechaGT } from '../dominio/formato'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tarjeta, Texto } from '../componentes/ui'
import { MapaRutas } from '../componentes/Mapa'

const COLORES = ['#0e7490', '#c2410c', '#0f766e', '#1d4ed8', '#a16207']

function useReloj() {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return ahora
}

export function Rutas() {
  const { estado, sucursalActiva, puede, ejecutar } = useErp()
  const ahora = useReloj()
  const [seleccion, setSeleccion] = useState<string | undefined>()
  const [despacho, setDespacho] = useState(false)
  const [sucursalId, setSucursalId] = useState(sucursalActiva === 'todas' ? 'suc-z10' : sucursalActiva)
  const [repartidorId, setRepartidorId] = useState('')
  const [vehiculo, setVehiculo] = useState('Panel 04')
  const [ordenes, setOrdenes] = useState<string[]>([])
  const [salir, setSalir] = useState(true)
  const visibles = estado.rutas.filter((r) => (sucursalActiva === 'todas' || r.sucursalId === sucursalActiva) && (r.fecha === fechaGT() || r.estado !== 'finalizada'))
  const activas = visibles.filter((r) => r.estado !== 'finalizada')
  const mapa = activas.map((ruta, i) => ({
    ruta,
    color: COLORES[i % COLORES.length],
    repartidor: estado.usuarios.find((u) => u.id === ruta.repartidorId)?.nombre ?? 'Repartidor',
  }))
  const posiciones = mapa.map(({ ruta }) => {
    const bodega = estado.sucursales.find((s) => s.id === ruta.sucursalId)!
    return { rutaId: ruta.id, punto: posicionRepartidor(ruta, bodega, ahora) }
  })
  const elegida = visibles.find((r) => r.id === seleccion) ?? visibles[0]
  const repartidores = estado.usuarios.filter((u) => u.activo && u.sucursalId === sucursalId && estado.roles.find((r) => r.id === u.rolId)?.esRepartidor)
  const disponibles = estado.ordenesVenta.filter((o) => o.sucursalId === sucursalId && ordenDespachable(estado, o))

  function armar(event: React.FormEvent) {
    event.preventDefault()
    const resultado = ejecutar((actual) => {
      const creada = crearRuta(actual, { sucursalId, repartidorId, vehiculo, ordenIds: ordenes })
      if (!creada.ok || !creada.estado || !creada.id || !salir) return creada
      return iniciarRuta(creada.estado, creada.id)
    })
    if (resultado.ok) { setDespacho(false); setOrdenes([]) }
  }

  return (
    <Pagina titulo="Rutas en vivo" detalle="Si el repartidor activa el GPS en su teléfono, el punto es esa ubicación. Si no hay señal reciente, el mapa avanza solo hacia la siguiente parada." accion={puede('rutas.despachar') && <Boton onClick={() => setDespacho(true)}>Despachar</Boton>}>
      <div className="grid h-[calc(100vh-11rem)] min-h-[520px] min-w-0 gap-3 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-2 overflow-auto">
          {visibles.map((ruta) => {
            const nombre = estado.usuarios.find((u) => u.id === ruta.repartidorId)?.nombre
            const hechas = ruta.paradas.filter((p) => p.estado === 'entregada').length
            const bodega = estado.sucursales.find((s) => s.id === ruta.sucursalId)!
            return (
              <button key={ruta.id} className={`w-full rounded-md bg-white p-3 text-left ${elegida?.id === ruta.id ? 'ring-2 ring-cyan-700' : ''}`} onClick={() => setSeleccion(ruta.id)}>
                <div className="flex items-start justify-between gap-2"><strong className="min-w-0">{nombre}</strong><Badge tono={ruta.estado === 'en_curso' ? 'alerta' : ruta.estado === 'finalizada' ? 'ok' : 'neutro'}>{ruta.estado.replaceAll('_', ' ')}</Badge></div>
                <div className="mt-1 text-xs text-slate-500">{ruta.codigo} · {ruta.vehiculo} · {hechas}/{ruta.paradas.length} · {kilometrosRuta(ruta, bodega).toFixed(1)} km{ruta.gps && ahora - Date.parse(ruta.gps.en) < 90_000 ? ' · GPS del teléfono' : ''}</div>
              </button>
            )
          })}
          {elegida && (
            <Tarjeta>
              <h2 className="font-display text-xl">{elegida.codigo}</h2>
              <ol className="mt-2 space-y-2 text-sm">
                {elegida.paradas.map((p, i) => {
                  const bodega = estado.sucursales.find((s) => s.id === elegida.sucursalId)!
                  const origen = i === 0 ? bodega : elegida.paradas[i - 1]
                  return (
                    <li key={p.id}>
                      <div className="font-medium break-words">{i + 1}. {p.nombre}</div>
                      <div className="break-words text-xs text-slate-500">{p.estado.replaceAll('_', ' ')} · {distanciaKm(origen, p).toFixed(1)} km · {p.resumen}</div>
                      {p.incidencia && <div className="text-xs text-rose-700">{p.incidencia}</div>}
                    </li>
                  )
                })}
              </ol>
            </Tarjeta>
          )}
        </div>
        <div className="relative z-0 h-full min-h-[420px] min-w-0 overflow-hidden rounded-md">
          <MapaRutas rutas={mapa} bodegas={estado.sucursales.map((s) => ({ id: s.id, nombre: s.nombre, punto: s }))} posiciones={posiciones} seleccionada={elegida?.id} onSeleccionar={setSeleccion} />
        </div>
      </div>
      <Modal titulo="Armar ruta" abierto={despacho} onCerrar={() => setDespacho(false)} ancho="max-w-lg">
        <form className="space-y-3" onSubmit={armar}>
          <Campo etiqueta="Sucursal">
            <Lista value={sucursalId} onChange={(e) => { setSucursalId(e.target.value); setOrdenes([]); setRepartidorId('') }}>
              {estado.sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Lista>
          </Campo>
          <Campo etiqueta="Repartidor">
            <Lista value={repartidorId} onChange={(e) => setRepartidorId(e.target.value)} required>
              <option value="">Elegí</option>
              {repartidores.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </Lista>
          </Campo>
          <Campo etiqueta="Vehículo"><Texto value={vehiculo} onChange={(e) => setVehiculo(e.target.value)} /></Campo>
          <div className="max-h-64 space-y-2 overflow-auto">
            {disponibles.map((orden) => {
              const serie = estado.series.find((s) => s.id === orden.serieId)
              return (
                <label key={orden.id} className="flex min-w-0 gap-2 rounded bg-slate-50 px-3 py-2 text-sm">
                  <input className="mt-1" type="checkbox" checked={ordenes.includes(orden.id)} onChange={(e) => setOrdenes(e.target.checked ? [...ordenes, orden.id] : ordenes.filter((id) => id !== orden.id))} />
                  <span className="min-w-0 break-words">{folio(serie?.prefijo ?? 'OV', orden.numero)} · {estado.socios.find((s) => s.id === orden.socioId)?.nombre}<br /><span className="text-xs text-slate-500">{orden.direccionEntrega}</span></span>
                </label>
              )
            })}
            {disponibles.length === 0 && <p className="text-sm text-slate-500">No hay órdenes confirmadas sin ruta en esta sucursal.</p>}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={salir} onChange={(e) => setSalir(e.target.checked)} /> Salir ahora y descontar bodega</label>
          <Boton type="submit">Crear ruta</Boton>
        </form>
      </Modal>
    </Pagina>
  )
}
