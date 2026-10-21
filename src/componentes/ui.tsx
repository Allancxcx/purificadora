import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export function cx(...partes: (string | false | undefined | null)[]) {
  return partes.filter(Boolean).join(' ')
}

const variantes = {
  primario: 'bg-[#0b3a4a] text-white hover:bg-[#12485b]',
  secundario: 'border border-[#c5cdd2] bg-white text-[#1b1b1b] hover:bg-[#f3f6f8]',
  peligro: 'border border-[#e7b2b2] bg-white text-[#8a1f1f] hover:bg-[#fdf2f2]',
  fantasma: 'text-[#3b3b3b] hover:bg-[#eef2f4]',
}

export function Boton({ variante = 'primario', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: keyof typeof variantes }) {
  return <button className={cx('rounded px-2.5 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50', variantes[variante], className)} {...props} />
}

const control = 'w-full rounded border border-[#c5cdd2] bg-white px-2.5 py-1.5 outline-none focus:border-[#0b3a4a]'

export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-semibold text-[#5c6770]">{etiqueta}</span>
      {children}
    </label>
  )
}

export function Texto({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, className)} {...props} />
}

export function Area({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(control, 'min-h-20', className)} {...props} />
}

export function Lista({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(control, className)} {...props} />
}

const tonos = {
  agua: 'bg-[#e7f2f6] text-[#0b3a4a]',
  ok: 'bg-[#e5f4ea] text-[#146c36]',
  alerta: 'bg-[#fff4d6] text-[#7a5b00]',
  peligro: 'bg-[#fde8e8] text-[#8a1f1f]',
  neutro: 'bg-[#eef1f3] text-[#3b3b3b]',
}

export function Badge({ tono = 'neutro', children }: { tono?: keyof typeof tonos; children: ReactNode }) {
  return <span className={cx('inline-flex rounded px-1.5 py-0.5 text-xs font-semibold', tonos[tono])}>{children}</span>
}

export function Modal({ titulo, abierto, onCerrar, children, ancho = 'max-w-2xl' }: { titulo: string; abierto: boolean; onCerrar: () => void; children: ReactNode; ancho?: string }) {
  if (!abierto) return null
  return (
    <div className="no-imprimir fixed inset-0 z-50 flex items-end justify-center bg-[#102027]/45 p-3 sm:items-center">
      <div className={cx('max-h-[92vh] w-full overflow-auto rounded-md border border-[#d5dde2] bg-white p-4 shadow-xl', ancho)}>
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-[#e6ebef] pb-3">
          <h2 className="text-lg font-semibold text-[#102027]">{titulo}</h2>
          <Boton variante="fantasma" onClick={onCerrar}>Cerrar</Boton>
        </div>
        {children}
      </div>
    </div>
  )
}

export interface ColumnaGrilla {
  id: string
  titulo: string
  fija?: boolean
}

interface PrefGrilla {
  orden: string[]
  ocultas: string[]
  tamano: number
}

const TAMANOS = [10, 25, 50]

function claveGrilla(id: string | undefined, ruta: string, columnas: ColumnaGrilla[]) {
  return id ?? `${ruta}:${columnas.map((c) => c.id).join('.')}`
}

function leerPref(clave: string, columnas: ColumnaGrilla[]): PrefGrilla {
  const base = { orden: columnas.map((c) => c.id), ocultas: [] as string[], tamano: 10 }
  try {
    const crudo = localStorage.getItem(`manantial.grilla.${clave}`)
    if (!crudo) return base
    const pref = JSON.parse(crudo) as PrefGrilla
    const conocidas = new Set(columnas.map((c) => c.id))
    const orden = [...pref.orden.filter((id) => conocidas.has(id)), ...columnas.map((c) => c.id).filter((id) => !pref.orden.includes(id))]
    return { orden, ocultas: pref.ocultas.filter((id) => conocidas.has(id)), tamano: TAMANOS.includes(pref.tamano) ? pref.tamano : 10 }
  } catch {
    return base
  }
}

export function Tabla({ id, columnas, filas, vacio }: {
  id?: string
  columnas: Array<string | ColumnaGrilla>
  filas: { id: string; celdas: ReactNode[]; onClick?: () => void }[]
  vacio: string
}) {
  const ruta = useLocation().pathname
  const base: ColumnaGrilla[] = columnas.map((columna, indice) => (
    typeof columna === 'string' ? { id: `c${indice}`, titulo: columna || 'Acciones', fija: columna === '' || columna === 'Acciones' } : columna
  ))
  const clave = claveGrilla(id, ruta, base)
  const [claveVista, setClaveVista] = useState(clave)
  const [pref, setPref] = useState<PrefGrilla>(() => leerPref(clave, base))
  const [pagina, setPagina] = useState(0)
  const [columnasAbiertas, setColumnasAbiertas] = useState(false)
  if (claveVista !== clave) {
    setClaveVista(clave)
    setPref(leerPref(clave, base))
    setPagina(0)
  }

  function guardar(siguiente: PrefGrilla) {
    setPref(siguiente)
    localStorage.setItem(`manantial.grilla.${clave}`, JSON.stringify(siguiente))
  }

  const visibles = pref.orden
    .map((colId) => base.find((columna) => columna.id === colId))
    .filter((columna): columna is ColumnaGrilla => Boolean(columna && (columna.fija || !pref.ocultas.includes(columna.id))))
  const paginas = Math.max(1, Math.ceil(filas.length / pref.tamano))
  const actual = Math.min(pagina, paginas - 1)
  const desde = filas.length === 0 ? 0 : actual * pref.tamano + 1
  const hasta = Math.min(filas.length, (actual + 1) * pref.tamano)
  const paginaFilas = filas.slice(actual * pref.tamano, hasta)

  function mover(colId: string, direccion: -1 | 1) {
    const orden = [...pref.orden]
    const indice = orden.indexOf(colId)
    const destino = indice + direccion
    if (indice < 0 || destino < 0 || destino >= orden.length) return
    const [extraida] = orden.splice(indice, 1)
    orden.splice(destino, 0, extraida)
    guardar({ ...pref, orden })
  }

  return (
    <div className="overflow-hidden rounded-md border border-[#d5dde2] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#e6ebef] bg-[#f7f9fa] px-3 py-2">
        <Boton variante="secundario" onClick={() => setColumnasAbiertas((v) => !v)}>{columnasAbiertas ? 'Cerrar columnas' : 'Columnas'}</Boton>
        <span className="text-xs text-[#5c6770]">{filas.length} registros</span>
        <label className="ml-auto flex items-center gap-2 text-xs text-[#5c6770]">
          Por página
          <select className="rounded border border-[#c5cdd2] bg-white px-2 py-1" value={pref.tamano} onChange={(e) => { guardar({ ...pref, tamano: Number(e.target.value) }); setPagina(0) }}>
            {TAMANOS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      {columnasAbiertas && (
        <div className="grid gap-2 border-b border-[#e6ebef] bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
          {pref.orden.map((colId) => {
            const columna = base.find((item) => item.id === colId)
            if (!columna) return null
            return (
              <div key={colId} className="flex items-center gap-2 rounded border border-[#e6ebef] px-2 py-1.5 text-sm">
                <input type="checkbox" checked={columna.fija || !pref.ocultas.includes(colId)} disabled={columna.fija} onChange={() => {
                  const ocultas = pref.ocultas.includes(colId) ? pref.ocultas.filter((id) => id !== colId) : [...pref.ocultas, colId]
                  guardar({ ...pref, ocultas })
                }} />
                <span className="flex-1">{columna.titulo}</span>
                <button type="button" className="px-1 text-[#5c6770]" onClick={() => mover(colId, -1)} aria-label="Subir columna">↑</button>
                <button type="button" className="px-1 text-[#5c6770]" onClick={() => mover(colId, 1)} aria-label="Bajar columna">↓</button>
              </div>
            )
          })}
        </div>
      )}
      {filas.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[#5c6770]">{vacio}</p> : visibles.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[#5c6770]">Elegí al menos una columna.</p> : (
        <div className="overflow-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#eef3f5] text-xs font-semibold text-[#3d4c54]">
              <tr>{visibles.map((columna) => <th key={columna.id} className="px-3 py-2">{columna.titulo}</th>)}</tr>
            </thead>
            <tbody>
              {paginaFilas.map((fila) => (
                <tr key={fila.id} onClick={fila.onClick} className={cx('border-t border-[#e6ebef] hover:bg-[#f4f8fa]', fila.onClick && 'cursor-pointer')}>
                  {visibles.map((columna) => <td key={columna.id} className="px-3 py-2 align-middle">{fila.celdas[base.findIndex((item) => item.id === columna.id)]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-[#e6ebef] px-3 py-2 text-sm">
        <span className="text-[#5c6770]">{desde}–{hasta} de {filas.length}</span>
        <div className="flex gap-2">
          <Boton variante="secundario" disabled={actual === 0} onClick={() => setPagina(actual - 1)}>Anterior</Boton>
          <span className="self-center text-xs text-[#5c6770]">{actual + 1} / {paginas}</span>
          <Boton variante="secundario" disabled={actual >= paginas - 1} onClick={() => setPagina(actual + 1)}>Siguiente</Boton>
        </div>
      </div>
    </div>
  )
}

export function Pagina({ titulo, detalle, accion, children }: { titulo: string; detalle?: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d5dde2] pb-3">
        <div>
          <h1 className="text-xl font-semibold text-[#102027]">{titulo}</h1>
          {detalle && <p className="mt-1 max-w-3xl text-sm text-[#4d5960]">{detalle}</p>}
        </div>
        {accion}
      </header>
      {children}
    </section>
  )
}

export function Tarjeta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-md border border-[#d5dde2] bg-white p-3', className)}>{children}</div>
}
