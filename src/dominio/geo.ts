export interface Punto {
  lat: number
  lng: number
}

export function distanciaKm(a: Punto, b: Punto): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export function rumbo(a: Punto, b: Punto): number {
  return (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI
}

export function interpolar(a: Punto, b: Punto, t: number): Punto {
  const c = Math.min(1, Math.max(0, t))
  return { lat: a.lat + (b.lat - a.lat) * c, lng: a.lng + (b.lng - a.lng) * c }
}
