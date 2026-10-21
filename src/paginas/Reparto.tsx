import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useErp } from '../datos/store'
import { iniciarRuta, marcarParada } from '../datos/motor'
import { posicionRepartidor } from '../datos/consultas'
import { MapaRutas } from '../componentes/Mapa'
import { Boton } from '../componentes/ui'

const MOTIVOS = ['No había nadie', 'Local cerrado', 'Rechazó el pedido', 'Dirección incorrecta']

interface Instalador extends Event { prompt: () => Promise<void> }

export function Reparto() {
  const { estado, sesion, puede, ejecutar } = useErp()
  const rolPropio = estado.roles.find((r) => r.id === sesion?.rolId)
  const [vista, setVista] = useState(rolPropio?.esRepartidor ? sesion?.id ?? '' : 'usr-juan')
  const [problema, setProblema] = useState(false)
  const [instalador, setInstalador] = useState<Instalador | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())
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

  return (
    <div className="min-h-screen bg-[#d7e6e4] lg:py-6">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#f4faf9] lg:min-h-[calc(100vh-3rem)] lg:overflow-hidden lg:rounded-[2rem] lg:shadow-2xl">
        <header className="bg-[#083844] px-5 py-4 text-white">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-cyan-100/80">
            <span>Manantial reparto</span>
            {puede('dashboard.ver') && <Link to="/" className="text-cyan-200">Oficina</Link>}
          </div>
          <h1 className="font-display mt-1 text-3xl">{((supervisando ? repartidores.find((u) => u.id === vista)?.nombre : sesion?.nombre) ?? '').split(' ')[0]}</h1>
          {supervisando && (
            <select className="mt-2 w-full rounded-xl bg-white/10 px-3 py-2 text-sm" value={vista} onChange={(e) => setVista(e.target.value)}>
              {repartidores.map((u) => <option key={u.id} value={u.id} className="text-slate-900">{u.nombre}</option>)}
            </select>
          )}
        </header>
        <div className="flex-1 space-y-4 px-4 py-4">
          {instalador && <Boton className="w-full" variante="secundario" onClick={() => instalador.prompt()}>Instalar en este teléfono</Boton>}
          {!ruta && <div className="rounded-3xl bg-white p-5 text-sm text-slate-600">No hay ruta abierta. Cuando despacho te asigne un panel, aparece aquí aunque se vaya la señal: la ruta queda en el teléfono.</div>}
          {ruta && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{ruta.codigo} · {ruta.vehiculo}</span>
                <span>{hechas}/{ruta.paradas.length}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-cyan-700" style={{ width: `${(hechas / ruta.paradas.length) * 100}%` }} /></div>
              {ruta.estado === 'planificada' && <Boton className="w-full py-4 text-base" onClick={() => ejecutar((e) => iniciarRuta(e, ruta.id))}>Iniciar ruta y cargar el camión</Boton>}
              {parada && (
                <article className="rounded-3xl bg-white p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-[0.14em] text-cyan-800">{parada.estado === 'llegada' ? 'Estás en el punto' : 'Siguiente parada'}</div>
                  <h2 className="font-display mt-1 text-3xl leading-tight text-[#083844]">{parada.nombre}</h2>
                  <p className="mt-1 text-sm text-slate-600">{parada.direccion}</p>
                  <p className="mt-2 text-sm">{parada.resumen}</p>
                  <p className="text-xs text-slate-500">Ventana {parada.ventana}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {parada.telefono && <a className="rounded-2xl bg-slate-100 py-3 text-center text-sm font-medium" href={`tel:${parada.telefono}`}>Llamar</a>}
                    <a className="rounded-2xl bg-slate-100 py-3 text-center text-sm font-medium" href={`https://www.google.com/maps/dir/?api=1&destination=${parada.lat},${parada.lng}`}>Navegar</a>
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
              <ol className="space-y-2 text-sm">
                {ruta.paradas.map((p, i) => (
                  <li key={p.id} className="rounded-2xl bg-white px-3 py-2">
                    <span className="font-medium">{i + 1}. {p.nombre}</span>
                    <span className="ml-2 text-xs text-slate-500">{p.estado.replaceAll('_', ' ')}</span>
                  </li>
                ))}
              </ol>
              {sucursal && (
                <div className="h-52 overflow-hidden rounded-3xl">
                  <MapaRutas
                    rutas={[{ ruta, color: '#0e7490', repartidor: estado.usuarios.find((u) => u.id === ruta.repartidorId)?.nombre ?? '' }]}
                    bodegas={[{ id: sucursal.id, nombre: sucursal.nombre, punto: sucursal }]}
                    posiciones={[{ rutaId: ruta.id, punto: posicionRepartidor(ruta, sucursal, ahora) }]}
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
