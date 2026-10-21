import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Droplets } from 'lucide-react'
import { useErp } from '../datos/store'
import { CLAVE_DEMO, CUENTAS_DEMO } from '../datos/semilla'
import { Boton, Campo, Texto } from '../componentes/ui'
import { useState } from 'react'

export function Login() {
  const { estado, sesion, puede, entrar } = useErp()
  const navigate = useNavigate()
  const [correo, setCorreo] = useState('admin@manantial.gt')
  const [clave, setClave] = useState(CLAVE_DEMO)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sesion) return
    navigate(puede('dashboard.ver') ? '/' : '/reparto', { replace: true })
  }, [sesion, puede, navigate])

  function enviar(event: React.FormEvent) {
    event.preventDefault()
    const fallo = entrar(correo, clave)
    setError(fallo ?? '')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-[#083844] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded bg-cyan-300 text-[#083844]"><Droplets /></span>
            <div className="font-display text-3xl">{estado.empresa.nombreComercial}</div>
          </div>
          <h1 className="font-display mt-16 max-w-md text-5xl leading-tight">Agua purificada, sucursales y reparto en una sola operación.</h1>
          <p className="mt-4 max-w-md text-cyan-50/80">Órdenes, series, facturación FEL, contabilidad e inventario. El administrador ve los paneles en el mapa mientras el repartidor marca la entrega desde el teléfono.</p>
        </div>
        <p className="text-sm text-cyan-100/70">Guatemala · demostración sin validez tributaria</p>
      </section>
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <h2 className="font-display text-4xl text-[#083844] lg:hidden">Manantial</h2>
          <p className="mt-2 text-sm text-slate-600">Entrá con un usuario de demostración. La clave de todos es <strong>{CLAVE_DEMO}</strong>.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {CUENTAS_DEMO.map((cuenta) => (
              <button key={cuenta.id} className="rounded border border-slate-200 bg-white px-3 py-2 text-left hover:border-cyan-700" onClick={() => { setCorreo(cuenta.correo); setClave(CLAVE_DEMO); setError(entrar(cuenta.correo, CLAVE_DEMO) ?? '') }}>
                <div className="text-sm font-medium">{cuenta.nombre}</div>
                <div className="text-xs text-slate-500">{cuenta.rol}</div>
              </button>
            ))}
          </div>
          <form className="mt-5 space-y-3" onSubmit={enviar}>
            <Campo etiqueta="Correo"><Texto value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="username" /></Campo>
            <Campo etiqueta="Clave"><Texto type="password" value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="current-password" /></Campo>
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <Boton className="w-full" type="submit">Entrar</Boton>
          </form>
        </div>
      </section>
    </div>
  )
}
