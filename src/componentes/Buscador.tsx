import { useId, useMemo, useState } from 'react'
import { cx } from './ui'

const control = 'w-full rounded border border-[#c5cdd2] bg-white px-2.5 py-1.5 outline-none focus:border-[#0b3a4a] disabled:bg-[#f7f9fa]'

export interface OpcionBuscador {
  value: string
  etiqueta: string
}

function plano(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function Buscador({ opciones, value, onChange, placeholder = 'Escribí para buscar', required, disabled, ariaLabel, className }: {
  opciones: OpcionBuscador[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  ariaLabel?: string
  className?: string
}) {
  const listaId = useId()
  const [abierto, setAbierto] = useState(false)
  const [consulta, setConsulta] = useState('')
  const [activo, setActivo] = useState(0)
  const [teclado, setTeclado] = useState(false)
  const elegida = opciones.find((opcion) => opcion.value === value)
  const visibles = useMemo(() => {
    const q = plano(consulta.trim())
    const base = q ? opciones.filter((opcion) => plano(opcion.etiqueta).includes(q)) : opciones
    return base.slice(0, 8)
  }, [opciones, consulta])

  function elegir(siguiente: string) {
    onChange(siguiente)
    setConsulta('')
    setAbierto(false)
    setTeclado(false)
  }

  function cerrar() {
    setAbierto(false)
    setConsulta('')
    setTeclado(false)
  }

  return (
    <div>
      <input
        className={cx(control, className)}
        role="combobox"
        aria-expanded={abierto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        required={required}
        disabled={disabled}
        placeholder={elegida ? undefined : placeholder}
        value={abierto ? consulta : (elegida?.etiqueta ?? '')}
        onFocus={() => { if (disabled) return; setAbierto(true); setConsulta(''); setActivo(0); setTeclado(false) }}
        onChange={(e) => { setConsulta(e.target.value); setAbierto(true); setActivo(0); setTeclado(false) }}
        onBlur={cerrar}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setAbierto(true)
            setTeclado(true)
            setActivo((n) => Math.min(n + 1, Math.max(visibles.length - 1, 0)))
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setTeclado(true)
            setActivo((n) => Math.max(n - 1, 0))
          }
          if (e.key === 'Enter' && abierto && (consulta.trim() || teclado) && visibles[activo]) {
            e.preventDefault()
            elegir(visibles[activo].value)
          }
          if (e.key === 'Escape') cerrar()
        }}
      />
      {abierto && !disabled && (
        <ul id={listaId} role="listbox" className="z-30 mt-1 max-h-52 overflow-auto rounded border border-[#d5dde2] bg-white shadow-lg" onMouseDown={(e) => e.preventDefault()}>
          {visibles.length === 0 && <li className="px-2.5 py-2 text-sm text-slate-500">No hay coincidencias.</li>}
          {visibles.map((opcion, indice) => (
            <li key={`${opcion.value}-${indice}`} role="option" aria-selected={opcion.value === value}>
              <button type="button" className={cx('block w-full px-2.5 py-1.5 text-left text-sm', indice === activo ? 'bg-[#e7f2f6]' : 'hover:bg-[#f3f6f8]')} onClick={() => elegir(opcion.value)}>
                {opcion.etiqueta}
              </button>
            </li>
          ))}
          {!consulta.trim() && opciones.length > visibles.length && <li className="px-2.5 py-1.5 text-xs text-slate-500">Escribí para ver el resto.</li>}
        </ul>
      )}
    </div>
  )
}
