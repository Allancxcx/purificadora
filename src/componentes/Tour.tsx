import { useEffect, useState } from 'react'
import { Boton } from './ui'

export interface PasoTour {
  selector: string
  titulo: string
  texto: string
}

export function Tour({ pasos, abierto, onCerrar, onPreparar }: { pasos: PasoTour[]; abierto: boolean; onCerrar: () => void; onPreparar?: (paso: PasoTour) => void }) {
  const [indice, setIndice] = useState(0)
  const [caja, setCaja] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const paso = pasos[indice]

  useEffect(() => {
    if (abierto) setIndice(0)
  }, [abierto])

  useEffect(() => {
    if (!abierto || !paso) return
    onPreparar?.(paso)
    const medir = () => {
      const elemento = document.querySelector(paso.selector)
      if (!elemento) {
        setCaja(null)
        return
      }
      elemento.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const rect = elemento.getBoundingClientRect()
      setCaja({ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 })
    }
    const id = window.setTimeout(medir, 40)
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [abierto, paso, onPreparar])

  if (!abierto || !paso) return null
  const abajo = (caja?.top ?? 80) > window.innerHeight * 0.55
  return (
    <div className="no-imprimir fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-[#102027]/55" onClick={onCerrar} />
      {caja && <div className="pointer-events-none absolute rounded border-2 border-white" style={{ top: caja.top, left: caja.left, width: caja.width, height: caja.height, boxShadow: '0 0 0 9999px rgba(16,32,39,.55)' }} />}
      <div className="absolute z-[81] w-[min(360px,calc(100%-1.5rem))] rounded-md border border-[#d5dde2] bg-white p-4 shadow-xl" style={caja ? { top: abajo ? Math.max(12, caja.top - 180) : Math.min(window.innerHeight - 190, caja.top + caja.height + 12), left: Math.min(Math.max(12, caja.left), window.innerWidth - 380) } : { top: 80, left: 16 }}>
        <div className="text-xs font-semibold text-[#5c6770]">Paso {indice + 1} de {pasos.length}</div>
        <h2 className="mt-1 text-lg font-semibold text-[#102027]">{paso.titulo}</h2>
        <p className="mt-2 text-sm text-[#3d4c54]">{paso.texto}</p>
        <div className="mt-4 flex justify-between gap-2">
          <Boton variante="fantasma" onClick={onCerrar}>Cerrar</Boton>
          <div className="flex gap-2">
            <Boton variante="secundario" disabled={indice === 0} onClick={() => setIndice(indice - 1)}>Atrás</Boton>
            <Boton onClick={() => indice === pasos.length - 1 ? onCerrar() : setIndice(indice + 1)}>{indice === pasos.length - 1 ? 'Listo' : 'Siguiente'}</Boton>
          </div>
        </div>
      </div>
    </div>
  )
}
