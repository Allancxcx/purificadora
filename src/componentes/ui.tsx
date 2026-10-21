import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function cx(...partes: (string | false | undefined | null)[]) {
  return partes.filter(Boolean).join(' ')
}

const variantes = {
  primario: 'bg-[#083844] text-white hover:bg-[#0c5164]',
  secundario: 'border border-slate-200 bg-white text-[#083844] hover:bg-slate-50',
  peligro: 'bg-rose-50 text-rose-800 hover:bg-rose-100',
  fantasma: 'text-slate-600 hover:bg-white',
}

export function Boton({ variante = 'primario', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: keyof typeof variantes }) {
  return <button className={cx('rounded-xl px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50', variantes[variante], className)} {...props} />
}

const control = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-cyan-700'

export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{etiqueta}</span>
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
  agua: 'bg-cyan-50 text-cyan-900',
  ok: 'bg-emerald-50 text-emerald-800',
  alerta: 'bg-amber-50 text-amber-900',
  peligro: 'bg-rose-50 text-rose-800',
  neutro: 'bg-slate-100 text-slate-600',
}

export function Badge({ tono = 'neutro', children }: { tono?: keyof typeof tonos; children: ReactNode }) {
  return <span className={cx('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', tonos[tono])}>{children}</span>
}

export function Modal({ titulo, abierto, onCerrar, children, ancho = 'max-w-2xl' }: { titulo: string; abierto: boolean; onCerrar: () => void; children: ReactNode; ancho?: string }) {
  if (!abierto) return null
  return (
    <div className="no-imprimir fixed inset-0 z-50 flex items-end justify-center bg-[#083844]/40 p-3 sm:items-center">
      <div className={cx('max-h-[92vh] w-full overflow-auto rounded-3xl bg-white p-5 shadow-2xl', ancho)}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl text-[#083844]">{titulo}</h2>
          <Boton variante="fantasma" onClick={onCerrar}>Cerrar</Boton>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Tabla({ columnas, filas, vacio }: { columnas: string[]; filas: { id: string; celdas: ReactNode[]; onClick?: () => void }[]; vacio: string }) {
  if (filas.length === 0) return <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{vacio}</p>
  return (
    <div className="overflow-auto rounded-2xl border border-slate-100">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
          <tr>{columnas.map((c) => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={fila.id} onClick={fila.onClick} className={cx('border-t border-slate-100', fila.onClick && 'cursor-pointer hover:bg-cyan-50/60')}>
              {fila.celdas.map((celda, i) => <td key={i} className="px-3 py-2.5 align-middle">{celda}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pagina({ titulo, detalle, accion, children }: { titulo: string; detalle?: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-[#083844]">{titulo}</h1>
          {detalle && <p className="mt-1 max-w-xl text-sm text-slate-600">{detalle}</p>}
        </div>
        {accion}
      </header>
      {children}
    </section>
  )
}

export function Tarjeta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-3xl bg-white p-4 shadow-sm', className)}>{children}</div>
}
