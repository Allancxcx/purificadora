const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function fechaGT(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function hace(dias: number): string {
  return fechaGT(new Date(Date.now() - dias * 86_400_000))
}

export function fechaHoraFel(d = new Date()): string {
  const fecha = fechaGT(d)
  const hora = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Guatemala',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(d)
  return `${fecha}T${hora}-06:00`
}

export function formatoFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${Number(d)} ${MESES[Number(m) - 1]} ${y}`
}

export function formatoFechaHora(iso: string): string {
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Guatemala',
  }).format(new Date(iso))
}

export function quetzales(n: number): string {
  return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(n)
}

export function folio(prefijo: string, numero: number): string {
  return `${prefijo}-${String(numero).padStart(6, '0')}`
}

export function nitLimpio(nit: string): string {
  return nit.replace(/[\s-]/g, '').trim().toUpperCase()
}

export function nitValido(nit: string): boolean {
  const n = nitLimpio(nit)
  if (n === 'CF') return true
  return /^[0-9]{3,12}[0-9K]$/.test(n)
}

export function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1, d))
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}
