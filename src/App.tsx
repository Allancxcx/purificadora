import { Navigate, Route, Routes } from 'react-router-dom'
import { Avisos, useErp } from './datos/store'
import { Shell } from './componentes/Shell'
import { Login } from './paginas/Login'
import { Dashboard } from './paginas/Dashboard'
import { Socios } from './paginas/Socios'
import { Ventas } from './paginas/Ventas'
import { Compras } from './paginas/Compras'
import { Facturas } from './paginas/Facturas'
import { Inventario } from './paginas/Inventario'
import { Contabilidad } from './paginas/Contabilidad'
import { Rutas } from './paginas/Rutas'
import { Sucursales } from './paginas/Sucursales'
import { Series } from './paginas/Series'
import { Seguridad } from './paginas/Seguridad'
import { Fel } from './paginas/Fel'
import { EmpresaPagina } from './paginas/Empresa'
import { Pos } from './paginas/Pos'
import { Reparto } from './paginas/Reparto'

function Guard({ codigo, children }: { codigo: string; children: React.ReactNode }) {
  const { puede } = useErp()
  if (!puede(codigo)) {
    return (
      <div className="rounded-3xl bg-white p-8">
        <h1 className="font-display text-3xl">Sin acceso</h1>
        <p className="mt-2 text-slate-600">Tu rol no tiene esta opción. Un administrador puede asignarla.</p>
      </div>
    )
  }
  return children
}

function Inicio() {
  const { puede } = useErp()
  if (!puede('dashboard.ver') && puede('reparto.operar')) return <Navigate to="/reparto" replace />
  return <Guard codigo="dashboard.ver"><Dashboard /></Guard>
}

function Privado({ children }: { children: React.ReactNode }) {
  const { sesion } = useErp()
  if (!sesion) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reparto" element={<Privado><Guard codigo="reparto.operar"><Reparto /></Guard></Privado>} />
        <Route element={<Privado><Shell /></Privado>}>
          <Route index element={<Inicio />} />
          <Route path="socios" element={<Guard codigo="socios.ver"><Socios /></Guard>} />
          <Route path="ventas" element={<Guard codigo="ventas.ver"><Ventas /></Guard>} />
          <Route path="pos" element={<Guard codigo="pos.operar"><Pos /></Guard>} />
          <Route path="compras" element={<Guard codigo="compras.ver"><Compras /></Guard>} />
          <Route path="facturas" element={<Guard codigo="facturas.ver"><Facturas /></Guard>} />
          <Route path="inventario" element={<Guard codigo="inventario.ver"><Inventario /></Guard>} />
          <Route path="contabilidad" element={<Guard codigo="contabilidad.ver"><Contabilidad /></Guard>} />
          <Route path="rutas" element={<Guard codigo="rutas.ver"><Rutas /></Guard>} />
          <Route path="sucursales" element={<Guard codigo="sucursales.ver"><Sucursales /></Guard>} />
          <Route path="series" element={<Guard codigo="series.ver"><Series /></Guard>} />
          <Route path="fel" element={<Guard codigo="fel.ver"><Fel /></Guard>} />
          <Route path="seguridad" element={<Guard codigo="seguridad.ver"><Seguridad /></Guard>} />
          <Route path="empresa" element={<Guard codigo="empresa.ver"><EmpresaPagina /></Guard>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Avisos />
    </>
  )
}
