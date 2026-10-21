import { useEffect } from 'react'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { Punto } from '../dominio/geo'
import type { Ruta } from '../dominio/tipos'

const CENTRO: [number, number] = [14.61, -90.55]

function Ajustar() {
  const mapa = useMap()
  useEffect(() => {
    const ajustar = () => mapa.invalidateSize()
    const id = window.setTimeout(ajustar, 200)
    window.addEventListener('resize', ajustar)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('resize', ajustar)
    }
  }, [mapa])
  return null
}

function Encuadrar({ rutas, bodegas }: { rutas: { ruta: Ruta }[]; bodegas: { id: string; punto: Punto }[] }) {
  const mapa = useMap()
  const clave = rutas.map((r) => r.ruta.id).join('|')
  useEffect(() => {
    const puntos: [number, number][] = []
    for (const { ruta } of rutas) {
      const bodega = bodegas.find((b) => b.id === ruta.sucursalId)
      if (bodega) puntos.push([bodega.punto.lat, bodega.punto.lng])
      for (const parada of ruta.paradas) puntos.push([parada.lat, parada.lng])
    }
    if (puntos.length > 0) {
      const id = window.setTimeout(() => mapa.fitBounds(puntos, { padding: [32, 32] }), 220)
      return () => window.clearTimeout(id)
    }
  }, [mapa, clave])
  return null
}

function iconoRepartidor(iniciales: string, color: string, activo: boolean) {
  return L.divIcon({
    className: 'border-0 bg-transparent',
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    html: `<div style="position:relative;width:46px;height:46px">
      ${activo ? `<span class="pulso" style="position:absolute;inset:6px;border-radius:999px;background:${color}"></span>` : ''}
      <span style="position:absolute;inset:9px;border-radius:999px;background:#083844;color:white;display:grid;place-items:center;font-size:11px;font-weight:700;box-shadow:0 6px 16px rgba(8,56,68,.35)">${iniciales}</span>
    </div>`,
  })
}

const COLOR_PARADA: Record<string, string> = {
  pendiente: '#64748b',
  en_camino: '#d97706',
  llegada: '#0e7490',
  entregada: '#059669',
  incidencia: '#e11d48',
}

export function MapaRutas({ rutas, bodegas, posiciones, seleccionada, onSeleccionar }: {
  rutas: { ruta: Ruta; color: string; repartidor: string }[]
  bodegas: { id: string; nombre: string; punto: Punto }[]
  posiciones: { rutaId: string; punto: Punto }[]
  seleccionada?: string
  onSeleccionar: (id: string) => void
}) {
  return (
    <MapContainer center={CENTRO} zoom={12} className="h-full w-full">
      <Ajustar />
      <Encuadrar rutas={rutas} bodegas={bodegas} />
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {bodegas.map((b) => (
        <CircleMarker key={b.id} center={[b.punto.lat, b.punto.lng]} radius={7} pathOptions={{ color: '#083844', fillColor: '#67e8f9', fillOpacity: 1 }}>
          <Popup>{b.nombre}</Popup>
        </CircleMarker>
      ))}
      {rutas.map(({ ruta, color }) => (
        <Polyline key={ruta.id} positions={[[bodegas.find((b) => b.id === ruta.sucursalId)?.punto.lat ?? CENTRO[0], bodegas.find((b) => b.id === ruta.sucursalId)?.punto.lng ?? CENTRO[1]], ...ruta.paradas.map((p) => [p.lat, p.lng] as [number, number])]} pathOptions={{ color, weight: ruta.id === seleccionada ? 5 : 3, opacity: 0.85 }} />
      ))}
      {rutas.flatMap(({ ruta }) => ruta.paradas.map((p) => (
        <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={ruta.id === seleccionada ? 7 : 5} pathOptions={{ color: COLOR_PARADA[p.estado], fillColor: COLOR_PARADA[p.estado], fillOpacity: 0.9 }} eventHandlers={{ click: () => onSeleccionar(ruta.id) }}>
          <Popup>
            <strong>{p.nombre}</strong>
            <br />{p.estado.replaceAll('_', ' ')}
            <br />{p.resumen}
          </Popup>
        </CircleMarker>
      )))}
      {rutas.map(({ ruta, color, repartidor }) => {
        const punto = posiciones.find((p) => p.rutaId === ruta.id)?.punto
        if (!punto || ruta.estado === 'finalizada') return null
        const iniciales = repartidor.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()
        return (
          <Marker key={ruta.id} position={[punto.lat, punto.lng]} icon={iconoRepartidor(iniciales, color, ruta.estado === 'en_curso')} eventHandlers={{ click: () => onSeleccionar(ruta.id) }}>
            <Popup><strong>{repartidor}</strong><br />{ruta.codigo} · {ruta.vehiculo}</Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}

function MarcadorClic({ onCambio }: { onCambio: (punto: Punto) => void }) {
  useMapEvents({ click: (e) => onCambio({ lat: Number(e.latlng.lat.toFixed(5)), lng: Number(e.latlng.lng.toFixed(5)) }) })
  return null
}

export function SelectorMapa({ lat, lng, onCambio }: { lat: number; lng: number; onCambio: (punto: Punto) => void }) {
  const centro: [number, number] = [lat || 14.6349, lng || -90.5069]
  return (
    <div className="h-56 overflow-hidden rounded">
      <MapContainer center={centro} zoom={13} className="h-full w-full">
        <Ajustar />
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MarcadorClic onCambio={onCambio} />
        {lat !== 0 && <CircleMarker center={[lat, lng]} radius={8} pathOptions={{ color: '#083844', fillColor: '#22d3ee', fillOpacity: 1 }} />}
      </MapContainer>
    </div>
  )
}
