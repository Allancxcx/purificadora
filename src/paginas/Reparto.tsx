import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useErp } from '../datos/store'
import { iniciarRuta, marcarParada, registrarCobro, registrarVentaPos, reportarGps } from '../datos/motor'
import { posicionRepartidor } from '../datos/consultas'
import { MapaRutas } from '../componentes/Mapa'
import { Boton } from '../componentes/ui'

const MOTIVOS = ['No había nadie', 'Local cerrado', 'Rechazó el pedido', 'Dirección incorrecta']

interface Instalador extends Event { prompt: () => Promise<void> }

export function Reparto() {
  const { estado, sesion, puede, ejecutar, certificar } = useErp()
  const rolPropio = estado.roles.find((r) => r.id === sesion?.rolId)
  const [vista, setVista] = useState(rolPropio?.esRepartidor ? sesion?.id ?? '' : 'usr-juan')
  const [problema, setProblema] = useState(false)
  const [extraId, setExtraId] = useState('')
  const [cantidadExtra, setCantidadExtra] = useState(1)
  const [efectivo, setEfectivo] = useState(true)
  const [receptor, setReceptor] = useState('')
  const [vendiendo, setVendiendo] = useState(false)
  const [instalador, setInstalador] = useState<Instalador | null>(null)
  const [ayuda, setAyuda] = useState(false)
  const [gps, setGps] = useState<'apagado' | 'activo' | 'denegado' | 'sin'>('apagado')
  const [ahora, setAhora] = useState(() => Date.now())
  const relojGps = useRef(0)
  const ultimoGps = useRef({ t: 0, lat: 0, lng: 0 })
  const rutaGps = useRef('')
  const supervisando = puede('rutas.ver')
  const repartidores = estado.usuarios.filter((u) => estado.roles.find((r) => r.id === u.rolId)?.esRepartidor)

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000)
    const capturar = (evento: Event) => {
      evento.preventDefault()
      setInstalador(evento as Instalador)
    }
    window.addEventListener('beforeinstallprompt', capturar)
    return () => { window.clearInterval(id); window.removeEventListener('beforeinstallprompt', capturar) }
  }, [])

  const rutas = estado.rutas.filter((r) => r.repartidorId === (supervisando ? vista || sesion?.id : sesion?.id) && r.estado !== 'finalizada')
  const ruta = rutas[0]
  const parada = ruta?.paradas.find((p) => p.estado === 'en_camino' || p.estado === 'llegada')
  const hechas = ruta?.paradas.filter((p) => p.estado === 'entregada').length ?? 0
  const sucursal = estado.sucursales.find((s) => s.id === ruta?.sucursalId)
  const propia = Boolean(ruta && sesion && ruta.repartidorId === sesion.id)
  const puedeGps = Boolean(rolPropio?.esRepartidor && (!supervisando || vista === sesion?.id))
  rutaGps.current = propia && ruta ? ruta.id : ''
  const instalada = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  const iphone = /iphone|ipad|ipod/i.test(navigator.userAgent)

  function publicarGps(lat: number, lng: number) {
    const id = rutaGps.current
    if (!id) return
    const t = Date.now()
    const salto = Math.abs(lat - ultimoGps.current.lat) + Math.abs(lng - ultimoGps.current.lng)
    if (t - ultimoGps.current.t < 8000 && salto < 0.0004) return
    ultimoGps.current = { t, lat, lng }
    ejecutar((actual) => reportarGps(actual, id, lat, lng))
  }

  function vigilarGps() {
    if (!navigator.geolocation || relojGps.current) return
    relojGps.current = navigator.geolocation.watchPosition(
      (pos) => { setGps('activo'); publicarGps(pos.coords.latitude, pos.coords.longitude) },
      () => setGps('denegado'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )
  }

  function pedirGps() {
    if (!navigator.geolocation) { setGps('sin'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGps('activo'); publicarGps(pos.coords.latitude, pos.coords.longitude); vigilarGps() },
      () => setGps('denegado'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
  }

  useEffect(() => () => {
    if (relojGps.current) navigator.geolocation.clearWatch(relojGps.current)
  }, [])

  return (
    <div className="min-h-screen bg-[#d7e6e4] lg:py-6">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#f4faf9] lg:min-h-[calc(100vh-3rem)] lg:overflow-hidden lg:rounded-[2rem] lg:shadow-2xl">
        <header className="bg-[#083844] px-5 py-4 text-white">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-cyan-100/80">
            <span>Manantial reparto</span>
            <span className="flex gap-3 normal-case tracking-normal">
              <button type="button" className="text-cyan-200" onClick={() => setAyuda((v) => !v)}>Ayuda</button>
              {puede('dashboard.ver') && <Link to="/" className="text-cyan-200">Oficina</Link>}
            </span>
          </div>
          <h1 className="font-display mt-1 text-3xl">{((supervisando ? repartidores.find((u) => u.id === vista)?.nombre : sesion?.nombre) ?? '').split(' ')[0]}</h1>
          {supervisando && (
            <select className="mt-2 w-full rounded-xl bg-white/10 px-3 py-2 text-sm" value={vista} onChange={(e) => setVista(e.target.value)}>
              {repartidores.map((u) => <option key={u.id} value={u.id} className="text-slate-900">{u.nombre}</option>)}
            </select>
          )}
        </header>
        <div className="flex-1 space-y-4 px-4 py-4">
          {ayuda && (
            <div className="rounded-md bg-white p-4 text-sm text-slate-700">
              <p className="font-semibold text-[#083844]">Ayuda del teléfono</p>
              <p className="mt-2">El GPS se activa con el botón de esta pantalla. El navegador pide permiso una vez. Si lo negaste, volvé a permitirlo en los ajustes del sitio.</p>
              <p className="mt-2">En la oficina, la guía del sistema se abre con el botón Guía, arriba a la derecha. La primera vez arranca sola.</p>
              <p className="mt-2">{iphone ? 'Para instalarla en iPhone: Compartir y luego Agregar a pantalla de inicio.' : 'Para instalarla en Android: el botón de aquí abajo, o el menú del navegador y Instalar aplicación.'}</p>
            </div>
          )}
          {!instalada && instalador && <Boton className="w-full" variante="secundario" onClick={() => instalador.prompt()}>Instalar en este teléfono</Boton>}
          {!instalada && !instalador && iphone && <p className="rounded-md bg-white px-3 py-2 text-sm">Para dejarla como aplicación: Compartir → Agregar a pantalla de inicio.</p>}
          {puedeGps && gps !== 'activo' && <Boton className="w-full" onClick={pedirGps}>{gps === 'denegado' ? 'El GPS está bloqueado. Reintentar' : 'Activar GPS de este teléfono'}</Boton>}
          {puedeGps && gps === 'activo' && <p className="text-sm text-cyan-900">GPS activo. La oficina ve este teléfono.</p>}
          {gps === 'sin' && <p className="text-sm text-rose-800">Este navegador no entrega ubicación.</p>}
          {!ruta && <div className="rounded-md bg-white p-5 text-sm text-slate-600">No hay ruta abierta. Cuando despacho te asigne un panel, aparece aquí aunque se vaya la señal: la ruta queda en el teléfono.</div>}
          {ruta && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{ruta.codigo} · {ruta.vehiculo}</span>
                <span>{hechas}/{ruta.paradas.length}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-cyan-700" style={{ width: `${(hechas / ruta.paradas.length) * 100}%` }} /></div>
              {ruta.estado === 'planificada' && <Boton className="w-full py-4 text-base" onClick={() => { ejecutar((e) => iniciarRuta(e, ruta.id)); if (puedeGps) pedirGps() }}>Iniciar ruta y cargar el camión</Boton>}
              {parada && (
                <article className="rounded-md bg-white p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-[0.14em] text-cyan-800">{parada.estado === 'llegada' ? 'Estás en el punto' : 'Siguiente parada'}</div>
                  <h2 className="font-display mt-1 text-3xl leading-tight text-[#083844]">{parada.nombre}</h2>
                  <p className="mt-1 text-sm text-slate-600">{parada.direccion}</p>
                  <p className="mt-2 text-sm">{parada.resumen}</p>
                  <p className="text-xs text-slate-500">Ventana {parada.ventana}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {parada.telefono && <a className="rounded bg-slate-100 py-3 text-center text-sm font-medium" href={`tel:${parada.telefono}`}>Llamar</a>}
                    <a className="rounded bg-slate-100 py-3 text-center text-sm font-medium" href={`https://www.google.com/maps/dir/?api=1&destination=${parada.lat},${parada.lng}`}>Navegar</a>
                  </div>
                  {parada.estado === 'en_camino' && <Boton className="mt-3 w-full" variante="secundario" onClick={() => ejecutar((e) => marcarParada(e, ruta.id, parada.id, 'llegada'))}>Llegué</Boton>}
                  <Boton className="mt-2 w-full py-4 text-base" onClick={() => ejecutar((e) => marcarParada(e, ruta.id, parada.id, 'entregada'))}>Entregado</Boton>
                  <Boton className="mt-2 w-full" variante="peligro" onClick={() => setProblema((v) => !v)}>No se pudo entregar</Boton>
                  {problema && (
                    <div className="mt-2 grid gap-2">
                      {MOTIVOS.map((motivo) => <Boton key={motivo} variante="secundario" onClick={() => { ejecutar((e) => marcarParada(e, ruta.id, parada.id, 'incidencia', motivo)); setProblema(false) }}>{motivo}</Boton>)}
                    </div>
                  )}
                </article>
              )}
              {ruta.estado === 'en_curso' && (ruta.extras ?? []).some((extra) => extra.cantidad - extra.vendida - extra.devuelta > 0) && (
                <article className="rounded-md bg-white p-4 text-sm">
                  <h2 className="font-medium text-[#083844]">Venta extra</h2>
                  <p className="mt-1 text-xs text-slate-500">Si el cliente pide más, se vende del extra del camión. El efectivo queda cobrado al certificar.</p>
                  <select className="mt-2 w-full rounded border border-slate-200 px-2 py-2" value={extraId} onChange={(e) => setExtraId(e.target.value)}>
                    <option value="">Producto</option>
                    {(ruta.extras ?? []).filter((extra) => extra.cantidad - extra.vendida - extra.devuelta > 0).map((extra) => {
                      const producto = estado.productos.find((p) => p.id === extra.productoId)
                      return <option key={extra.productoId} value={extra.productoId}>{producto?.nombre} · quedan {extra.cantidad - extra.vendida - extra.devuelta}</option>
                    })}
                  </select>
                  <input className="mt-2 w-full rounded border border-slate-200 px-2 py-2" type="number" min={1} value={cantidadExtra} onChange={(e) => setCantidadExtra(Number(e.target.value))} />
                  <input className="mt-2 w-full rounded border border-slate-200 px-2 py-2" placeholder="A quién se vendió" value={receptor} onChange={(e) => setReceptor(e.target.value)} />
                  <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={efectivo} onChange={(e) => setEfectivo(e.target.checked)} /> Efectivo</label>
                  <Boton className="mt-2 w-full" disabled={vendiendo || !extraId} onClick={async () => {
                    if (!sesion || !extraId) return
                    const producto = estado.productos.find((p) => p.id === extraId)
                    if (!producto) return
                    setVendiendo(true)
                    try {
                      const venta = ejecutar((actual) => registrarVentaPos(actual, {
                        sucursalId: ruta.sucursalId,
                        socioId: 'soc-cf',
                        vendedorId: sesion.id,
                        rutaId: ruta.id,
                        receptorNombre: receptor || parada?.nombre || 'Cliente de ruta',
                        sectorId: ruta.sectorId,
                        lineas: [{ productoId: producto.id, cantidad: cantidadExtra, precioUnitario: producto.precio, descuento: 0 }],
                      }))
                      if (!venta.ok || !venta.id) return
                      const certificada = await certificar(venta.id)
                      if (certificada && efectivo) ejecutar((actual) => registrarCobro(actual, venta.id!, producto.precio * cantidadExtra, 'efectivo', 'Efectivo en ruta'))
                      setExtraId('')
                      setReceptor('')
                      setCantidadExtra(1)
                    } finally {
                      setVendiendo(false)
                    }
                  }}>{vendiendo ? 'Vendiendo…' : 'Vender del camión'}</Boton>
                </article>
              )}
              <ol className="space-y-2 text-sm">
                {ruta.paradas.map((p, i) => (
                  <li key={p.id} className="rounded bg-white px-3 py-2">
                    <span className="font-medium">{i + 1}. {p.nombre}</span>
                    <span className="ml-2 text-xs text-slate-500">{p.estado.replaceAll('_', ' ')}</span>
                  </li>
                ))}
              </ol>
              {sucursal && (
                <div className="h-52 overflow-hidden rounded-md">
                  <MapaRutas
                    rutas={[{ ruta, color: '#0e7490', repartidor: estado.usuarios.find((u) => u.id === ruta.repartidorId)?.nombre ?? '' }]}
                    bodegas={[{ id: sucursal.id, nombre: sucursal.nombre, punto: sucursal, matriz: sucursal.esMatriz }]}
                    posiciones={[{ rutaId: ruta.id, punto: gps === 'activo' && ultimoGps.current.t ? { lat: ultimoGps.current.lat, lng: ultimoGps.current.lng } : posicionRepartidor(ruta, sucursal, ahora) }]}
                    seleccionada={ruta.id}
                    onSeleccionar={() => undefined}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
