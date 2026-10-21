import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BookOpen, Building2, Droplets, FileText, Hash, KeyRound, Landmark, LayoutDashboard, Map, Menu, Package, ShieldCheck, ShoppingBag, Store, Truck, Users, X } from 'lucide-react'
import { useErp } from '../datos/store'
import { Boton, cx } from './ui'

const NAV = [
  { to: '/', codigo: 'dashboard.ver', label: 'Tablero', icon: LayoutDashboard, fin: true },
  { to: '/socios', codigo: 'socios.ver', label: 'Socios', icon: Users, fin: false },
  { to: '/ventas', codigo: 'ventas.ver', label: 'Ventas', icon: ShoppingBag, fin: false },
  { to: '/pos', codigo: 'pos.operar', label: 'Punto de venta', icon: Store, fin: false },
  { to: '/compras', codigo: 'compras.ver', label: 'Compras', icon: Truck, fin: false },
  { to: '/facturas', codigo: 'facturas.ver', label: 'Facturas', icon: FileText, fin: false },
  { to: '/inventario', codigo: 'inventario.ver', label: 'Inventario', icon: Package, fin: false },
  { to: '/contabilidad', codigo: 'contabilidad.ver', label: 'Contabilidad', icon: BookOpen, fin: false },
  { to: '/rutas', codigo: 'rutas.ver', label: 'Rutas en vivo', icon: Map, fin: false },
  { to: '/sucursales', codigo: 'sucursales.ver', label: 'Sucursales', icon: Building2, fin: false },
  { to: '/series', codigo: 'series.ver', label: 'Series', icon: Hash, fin: false },
  { to: '/fel', codigo: 'fel.ver', label: 'Certificación', icon: ShieldCheck, fin: false },
  { to: '/seguridad', codigo: 'seguridad.ver', label: 'Roles', icon: KeyRound, fin: false },
  { to: '/empresa', codigo: 'empresa.ver', label: 'Empresa', icon: Landmark, fin: false },
]

export function Shell() {
  const { estado, sesion, rol, sucursalActiva, verEmpresa, setSucursalActiva, puede, salir, restaurar } = useErp()
  const [abierto, setAbierto] = useState(false)
  const navigate = useNavigate()
  const enCurso = estado.rutas.filter((r) => r.estado === 'en_curso').length

  const lateral = (
    <div className="flex h-full flex-col bg-[#083844] text-white">
      <div className="flex items-center gap-3 px-4 py-5">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300 text-[#083844]"><Droplets size={20} /></span>
        <div>
          <div className="font-display text-xl leading-none">{estado.empresa.nombreComercial}</div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-100/80">Purificadora</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-auto px-3 pb-4">
        {NAV.filter((item) => puede(item.codigo)).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.fin} onClick={() => setAbierto(false)} className={({ isActive }) => cx('flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm', isActive ? 'bg-white text-[#083844]' : 'text-cyan-50 hover:bg-white/10')}>
            <item.icon size={18} />
            <span>{item.label}</span>
            {item.to === '/rutas' && enCurso > 0 && <span className="ml-auto rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-semibold text-[#083844]">{enCurso}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4 text-xs text-cyan-100/80">Demostración. No envía documentos a la SAT.</div>
    </div>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="hidden lg:block">{lateral}</aside>
      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setAbierto(false)} aria-label="Cerrar menú" />
          <div className="relative h-full w-[260px]">{lateral}</div>
        </div>
      )}
      <div className="min-w-0">
        <header className="no-imprimir sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-slate-200/80 bg-[#e7eeee]/90 px-4 py-3 backdrop-blur">
          <button className="grid h-10 w-10 place-items-center rounded-xl bg-white lg:hidden" onClick={() => setAbierto(true)} aria-label="Abrir menú"><Menu size={18} /></button>
          {verEmpresa ? (
            <select className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={sucursalActiva} onChange={(e) => setSucursalActiva(e.target.value)}>
              <option value="todas">Todas las sucursales</option>
              {estado.sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          ) : (
            <div className="rounded-xl bg-white px-3 py-2 text-sm">{estado.sucursales.find((s) => s.id === sucursalActiva)?.nombre}</div>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            {puede('reparto.operar') && <Boton variante="secundario" onClick={() => navigate('/reparto')}>Handheld</Boton>}
            <div className="hidden text-right sm:block">
              <div className="font-medium">{sesion?.nombre}</div>
              <div className="text-xs text-slate-500">{rol?.nombre}</div>
            </div>
            <Boton variante="fantasma" onClick={() => { if (window.confirm('¿Restaurar los datos de demostración?')) restaurar() }}>Restaurar</Boton>
            <Boton variante="secundario" onClick={() => { salir(); navigate('/login') }}><X size={16} /></Boton>
          </div>
        </header>
        <main className="px-4 py-5 lg:px-6"><Outlet /></main>
      </div>
    </div>
  )
}
