import { useEffect, useState } from 'react'
import { useErp } from '../datos/store'
import { crearRuta, iniciarRuta, reintegrarExtra } from '../datos/motor'
import { folio, kilometrosRuta, ordenDespachable, pendienteLinea, posicionRepartidor, sucursalesDe } from '../datos/consultas'
import { distanciaKm } from '../dominio/geo'
import { fechaGT } from '../dominio/formato'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tarjeta } from '../componentes/ui'
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
  const { estado, sucursalActiva, permitidas, sede, enVista, puede, ejecutar } = useErp()
  const ahora = useReloj()
  const [seleccion, setSeleccion] = useState<string | undefined>()
  const [despacho, setDespacho] = useState(false)
  const [sucursalId, setSucursalId] = useState(sede)
  const [repartidorId, setRepartidorId] = useState('')
  const [vehiculoId, setVehiculoId] = useState(() => estado.vehiculos.find((v) => v.sucursalId === sede && v.estado === 'disponible')?.id ?? '')
  const [ordenes, setOrdenes] = useState<string[]>([])
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [sectorId, setSectorId] = useState(() => estado.sectores?.find((sector) => sector.sucursalId === sede && sector.activo)?.id ?? '')
  const [extras, setExtras] = useState<{ productoId: string; cantidad: number }[]>([])
  const [salir, setSalir] = useState(true)
  useEffect(() => {
    if (sucursalActiva === 'todas') return
    setSucursalId(sucursalActiva)
    setRepartidorId('')
    setOrdenes([])
    setCantidades({})
    setExtras([])
    setSectorId(estado.sectores?.find((sector) => sector.sucursalId === sucursalActiva && sector.activo)?.id ?? '')
    setVehiculoId(estado.vehiculos.find((v) => v.sucursalId === sucursalActiva && v.estado === 'disponible')?.id ?? '')
  }, [sucursalActiva])
  const visibles = estado.rutas.filter((r) => enVista(r.sucursalId) && (r.fecha === fechaGT() || r.estado !== 'finalizada'))
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
  const repartidores = estado.usuarios.filter((u) => u.activo && sucursalesDe(u).includes(sucursalId) && estado.roles.find((r) => r.id === u.rolId)?.esRepartidor)
  const flota = estado.vehiculos.filter((v) => v.sucursalId === sucursalId && v.estado === 'disponible')
  const sectores = (estado.sectores ?? []).filter((sector) => sector.activo && sector.sucursalId === sucursalId)
  const disponibles = estado.ordenesVenta.filter((o) => {
    if (o.sucursalId !== sucursalId || !ordenDespachable(estado, o)) return false
    const sectorOrden = o.sectorId || estado.socios.find((s) => s.id === o.socioId)?.sectorId
    return !sectorId || !sectorOrden || sectorOrden === sectorId
  })
  const productosExtra = estado.productos.filter((p) => p.activo && p.controlaInventario)

  function armar(event: React.FormEvent) {
    event.preventDefault()
    const resultado = ejecutar((actual) => {
      const creada = crearRuta(actual, {
        sucursalId,
        sectorId,
        repartidorId,
        vehiculoId,
        ordenIds: ordenes,
        cargas: ordenes.map((ordenId) => {
          const orden = actual.ordenesVenta.find((o) => o.id === ordenId)
          return {
            ordenId,
            lineas: (orden?.lineas ?? []).map((linea) => ({ lineaId: linea.id, cantidad: cantidades[linea.id] ?? pendienteLinea(linea) })),
          }
        }),
        extras: extras.filter((extra) => extra.cantidad > 0),
      })
      if (!creada.ok || !creada.estado || !creada.id || !salir) return creada
      return iniciarRuta(creada.estado, creada.id)
    })
    if (resultado.ok) { setDespacho(false); setOrdenes([]); setCantidades({}); setExtras([]) }
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
                <div className="mt-1 text-xs text-slate-500">{ruta.codigo} · {estado.sectores?.find((sector) => sector.id === ruta.sectorId)?.codigo ?? 'Sin sector'} · {ruta.vehiculo} · {hechas}/{ruta.paradas.length} · {kilometrosRuta(ruta, bodega).toFixed(1)} km{ruta.gps && ahora - Date.parse(ruta.gps.en) < 90_000 ? ' · GPS del teléfono' : ''}</div>
              </button>
            )
          })}
          {elegida && (
            <Tarjeta>
              <h2 className="font-display text-xl">{elegida.codigo}</h2>
              <p className="text-xs text-slate-500">{estado.sectores?.find((sector) => sector.id === elegida.sectorId)?.nombre ?? 'Sin sector'}</p>
              {(elegida.extras ?? []).length > 0 && (
                <div className="mt-2 text-sm">
                  <div className="font-medium">Extra en el camión</div>
                  {(elegida.extras ?? []).map((extra) => {
                    const producto = estado.productos.find((p) => p.id === extra.productoId)
                    const queda = extra.cantidad - extra.vendida - extra.devuelta
                    return <div key={extra.productoId} className="text-xs text-slate-600">{producto?.nombre}: cargó {extra.cantidad}, vendió {extra.vendida}, reintegró {extra.devuelta}, queda {queda}</div>
                  })}
                  {puede('rutas.despachar') && elegida.estado === 'en_curso' && (elegida.extras ?? []).some((extra) => extra.cantidad - extra.vendida - extra.devuelta > 0) && (
                    <Boton className="mt-2" variante="secundario" onClick={() => ejecutar((actual) => reintegrarExtra(actual, elegida.id))}>Reintegrar sobrante</Boton>
                  )}
                </div>
              )}
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
          <MapaRutas rutas={mapa} bodegas={estado.sucursales.filter((s) => permitidas.includes(s.id)).map((s) => ({ id: s.id, nombre: s.nombre, punto: s, matriz: s.esMatriz }))} posiciones={posiciones} seleccionada={elegida?.id} onSeleccionar={setSeleccion} />
        </div>
      </div>
      <Modal titulo="Armar ruta" abierto={despacho} onCerrar={() => setDespacho(false)} ancho="max-w-lg">
        <form className="space-y-3" onSubmit={armar}>
          <Campo etiqueta="Sucursal">
            <Lista value={sucursalId} onChange={(e) => {
              const id = e.target.value
              setSucursalId(id)
              setOrdenes([])
              setCantidades({})
              setExtras([])
              setRepartidorId('')
              setSectorId(estado.sectores?.find((sector) => sector.sucursalId === id && sector.activo)?.id ?? '')
              setVehiculoId(estado.vehiculos.find((v) => v.sucursalId === id && v.estado === 'disponible')?.id ?? '')
            }}>
              {estado.sucursales.filter((s) => permitidas.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </Lista>
          </Campo>
          <Campo etiqueta="Repartidor">
            <Lista value={repartidorId} onChange={(e) => setRepartidorId(e.target.value)} required>
              <option value="">Elegí</option>
              {repartidores.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </Lista>
          </Campo>
          <Campo etiqueta="Sector">
            <Lista value={sectorId} onChange={(e) => { setSectorId(e.target.value); setOrdenes([]) }} required>
              <option value="">Elegí</option>
              {sectores.map((sector) => <option key={sector.id} value={sector.id}>{sector.codigo} · {sector.nombre}</option>)}
            </Lista>
          </Campo>
          <Campo etiqueta="Vehículo">
            <Lista value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)} required>
              <option value="">Elegí</option>
              {flota.map((v) => <option key={v.id} value={v.id}>{v.nombre} · {v.placa}</option>)}
            </Lista>
          </Campo>
          {flota.length === 0 && <p className="text-sm text-slate-500">No hay vehículos disponibles en esta sucursal.</p>}
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Extra que sube además de los pedidos. Al salir se contabiliza. Lo que no se venda vuelve a bodega.</p>
            {extras.map((extra, indice) => (
              <div key={indice} className="grid grid-cols-[1fr_5rem] gap-2">
                <Lista aria-label="Producto extra" value={extra.productoId} onChange={(e) => setExtras(extras.map((item, i) => i === indice ? { ...item, productoId: e.target.value } : item))}>
                  {productosExtra.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </Lista>
                <input className="rounded border border-[#c5cdd2] bg-white px-2 py-1 text-right" aria-label="Cantidad extra" type="number" min={1} value={extra.cantidad} onChange={(e) => setExtras(extras.map((item, i) => i === indice ? { ...item, cantidad: Number(e.target.value) } : item))} />
              </div>
            ))}
            <Boton type="button" variante="secundario" onClick={() => setExtras([...extras, { productoId: productosExtra[0]?.id ?? '', cantidad: 1 }])}>Agregar extra</Boton>
          </div>
          <div className="max-h-72 space-y-2 overflow-auto">
            <p className="text-xs text-slate-500">Marcá la orden y escribí cuánto sube al camión. Lo que dejes en cero no sale y queda para otra ruta.</p>
            {disponibles.map((orden) => {
              const serie = estado.series.find((s) => s.id === orden.serieId)
              const marcada = ordenes.includes(orden.id)
              return (
                <div key={orden.id} className="rounded bg-slate-50 px-3 py-2 text-sm">
                  <label className="flex min-w-0 gap-2">
                    <input className="mt-1" type="checkbox" checked={marcada} onChange={(e) => {
                      setOrdenes(e.target.checked ? [...ordenes, orden.id] : ordenes.filter((id) => id !== orden.id))
                      if (e.target.checked) {
                        setCantidades((prev) => {
                          const siguiente = { ...prev }
                          for (const linea of orden.lineas) if (siguiente[linea.id] == null) siguiente[linea.id] = pendienteLinea(linea)
                          return siguiente
                        })
                      }
                    }} />
                    <span className="min-w-0 break-words">{folio(serie?.prefijo ?? 'OV', orden.numero)} · {estado.socios.find((s) => s.id === orden.socioId)?.nombre}<br /><span className="text-xs text-slate-500">{orden.direccionEntrega}</span></span>
                  </label>
                  {marcada && (
                    <div className="mt-2 space-y-1 pl-6">
                      {orden.lineas.map((linea) => {
                        const tope = pendienteLinea(linea)
                        return (
                          <label key={linea.id} className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 break-words text-xs">{linea.descripcion}</span>
                            <span className="text-xs text-slate-500">pedido {tope}</span>
                            <input
                              className="w-16 rounded border border-[#c5cdd2] bg-white px-2 py-1 text-right"
                              type="number"
                              min={0}
                              max={tope}
                              step={1}
                              value={cantidades[linea.id] ?? tope}
                              onChange={(e) => {
                                const pedido = Number(e.target.value)
                                const cantidad = Number.isFinite(pedido) ? Math.min(tope, Math.max(0, pedido)) : 0
                                setCantidades((prev) => ({ ...prev, [linea.id]: cantidad }))
                              }}
                            />
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
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
