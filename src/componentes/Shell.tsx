import { useCallback, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { BookOpen, Building2, Car, Droplets, FileText, Hash, KeyRound, Landmark, LayoutDashboard, Map, Menu, Package, ShieldCheck, ShoppingBag, Store, Tags, Truck, Users, X } from 'lucide-react'
import { useErp } from '../datos/store'
import { Boton, cx } from './ui'
import { Tour, type PasoTour } from './Tour'

const PASOS: PasoTour[] = [
  { selector: '[data-tour="marca"]', titulo: 'La operación', texto: 'Este es el nombre comercial. La razón social, el NIT y el teléfono se editan en Empresa y también salen en la certificación.' },
  { selector: '[data-tour="menu"]', titulo: 'Menú', texto: 'Cada opción depende del rol. El punto de venta cobra en mostrador. Facturas maneja abierta, cerrada y cancelada.' },
  { selector: '[data-tour="nav-facturas"]', titulo: 'Facturas', texto: 'Abierta cuando se crea. Cerrada al certificar. Si sigue abierta, se cancela aquí. Si ya está cerrada, la anula el certificador o una nota de crédito. La nota de débito solo aumenta lo que debe el cliente.' },
  { selector: '[data-tour="nav-contabilidad"]', titulo: 'Libros', texto: 'El diario, el mayor y los estados salen de los mismos asientos. En cada grilla podés elegir columnas, orden y cuántas filas ver.' },
  { selector: '[data-tour="nav-precios"]', titulo: 'Listas de precios', texto: 'Al armar el pedido, el precio de cada producto sale de la lista del cliente. En la línea todavía lo podés cambiar.' },
  { selector: '[data-tour="nav-activos"]', titulo: 'Flota', texto: 'Los vehículos son activos fijos. Al despachar se elige uno que esté disponible en la sucursal.' },
  { selector: '[data-tour="sucursal"]', titulo: 'Vista', texto: 'General reúne toda la empresa y parte los reportes por sucursal. Si elegís una sucursal, el tablero, los documentos, el inventario y la contabilidad quedan solo de esa tienda.' },
  { selector: '[data-tour="guia"]', titulo: 'Esta guía', texto: 'Podés volver a abrirla cuando quieras. Es una aplicación instalable: en el teléfono, desde el navegador, se agrega a la pantalla de inicio.' },
]

const NAV = [
  { to: '/', codigo: 'dashboard.ver', label: 'Tablero', icon: LayoutDashboard, fin: true },
  { to: '/socios', codigo: 'socios.ver', label: 'Socios', icon: Users, fin: false },
  { to: '/ventas', codigo: 'ventas.ver', label: 'Ventas', icon: ShoppingBag, fin: false },
  { to: '/precios', codigo: 'precios.ver', label: 'Listas de precios', icon: Tags, fin: false },
  { to: '/pos', codigo: 'pos.operar', label: 'Punto de venta', icon: Store, fin: false },
  { to: '/compras', codigo: 'compras.ver', label: 'Compras', icon: Truck, fin: false },
  { to: '/facturas', codigo: 'facturas.ver', label: 'Facturas', icon: FileText, fin: false },
  { to: '/inventario', codigo: 'inventario.ver', label: 'Inventario', icon: Package, fin: false },
  { to: '/contabilidad', codigo: 'contabilidad.ver', label: 'Contabilidad', icon: BookOpen, fin: false },
  { to: '/activos', codigo: 'activos.ver', label: 'Activos', icon: Car, fin: false },
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
  const [tour, setTour] = useState(() => localStorage.getItem('manantial.tour') !== 'visto')
  const navigate = useNavigate()
  const prepararTour = useCallback((paso: PasoTour) => {
    if (window.innerWidth < 1024 && paso.selector.startsWith('[data-tour="nav')) setAbierto(true)
  }, [])
  function cerrarTour() {
    localStorage.setItem('manantial.tour', 'visto')
    setTour(false)
  }
  const enCurso = estado.rutas.filter((r) => r.estado === 'en_curso' && (sucursalActiva === 'todas' || r.sucursalId === sucursalActiva)).length

  const lateral = (
    <div className="flex h-full flex-col bg-[#083844] text-white">
      <div className="flex items-center gap-3 px-4 py-4" data-tour="marca">
        <span className="grid h-9 w-9 place-items-center rounded bg-cyan-300 text-[#083844]"><Droplets size={18} /></span>
        <div>
          <div className="font-display text-xl leading-none">{estado.empresa.nombreComercial}</div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-100/80">Purificadora</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-auto px-2 pb-4" data-tour="menu">
        {NAV.filter((item) => puede(item.codigo)).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.fin} data-tour={`nav-${item.to.replace('/', '') || 'inicio'}`} onClick={() => setAbierto(false)} className={({ isActive }) => cx('flex items-center gap-3 rounded px-3 py-2 text-sm', isActive ? 'bg-white text-[#083844]' : 'text-cyan-50 hover:bg-white/10')}>
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
        <header className="no-imprimir sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-[#d5dde2] bg-white px-3 py-2">
          <button className="grid h-9 w-9 place-items-center rounded border border-[#d5dde2] lg:hidden" onClick={() => setAbierto(true)} aria-label="Abrir menú"><Menu size={18} /></button>
          <label className="flex items-center gap-2 text-sm" data-tour="sucursal">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5c6770]">Vista</span>
            {verEmpresa ? (
              <select className="rounded border border-[#c5cdd2] bg-white px-2 py-1.5 text-sm" aria-label="Vista" value={sucursalActiva} onChange={(e) => setSucursalActiva(e.target.value)}>
                <option value="todas">General</option>
                {estado.sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            ) : (
              <span className="rounded border border-[#d5dde2] bg-[#f7f9fa] px-2 py-1.5">{estado.sucursales.find((s) => s.id === sucursalActiva)?.nombre}</span>
            )}
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            <Boton variante="secundario" data-tour="guia" onClick={() => setTour(true)}>Guía</Boton>
            {puede('reparto.operar') && <Boton variante="secundario" onClick={() => navigate('/reparto')}>Handheld</Boton>}
            <div className="hidden text-right sm:block">
              <div className="font-medium">{sesion?.nombre}</div>
              <div className="text-xs text-slate-500">{rol?.nombre}</div>
            </div>
            <Boton variante="fantasma" onClick={() => { if (window.confirm('¿Restaurar los datos de demostración?')) restaurar() }}>Restaurar</Boton>
            <Boton variante="secundario" onClick={() => { salir(); navigate('/login') }}><X size={16} /></Boton>
          </div>
        </header>
        <main className="px-3 py-4 lg:px-5"><Outlet /></main>
      </div>
      <Tour pasos={PASOS.filter((paso) => paso.selector !== '[data-tour="nav-facturas"]' || puede('facturas.ver')).filter((paso) => paso.selector !== '[data-tour="nav-contabilidad"]' || puede('contabilidad.ver')).filter((paso) => paso.selector !== '[data-tour="nav-precios"]' || puede('precios.ver')).filter((paso) => paso.selector !== '[data-tour="nav-activos"]' || puede('activos.ver'))} abierto={tour} onCerrar={cerrarTour} onPreparar={prepararTour} />
    </div>
  )
}
