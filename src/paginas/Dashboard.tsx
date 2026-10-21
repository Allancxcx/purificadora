import { Link } from 'react-router-dom'
import { useErp } from '../datos/store'
import { saldoFactura, stock } from '../datos/consultas'
import { totalesVenta } from '../dominio/calculos'
import { fechaGT, formatoFecha, quetzales } from '../dominio/formato'
import { Tarjeta } from '../componentes/ui'

function deAqui<T extends { sucursalId: string }>(lista: T[], sucursalId: string) {
  return sucursalId === 'todas' ? lista : lista.filter((item) => item.sucursalId === sucursalId)
}

export function Dashboard() {
  const { estado, sucursalActiva } = useErp()
  const mes = fechaGT().slice(0, 7)
  const facturas = deAqui(estado.facturas, sucursalActiva)
  const certificadas = facturas.filter((f) => f.estado === 'certificada' && f.fecha.startsWith(mes))
  const vendido = certificadas.filter((f) => f.tipo === 'FACT' && !f.ajustada).reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
  const notas = certificadas.filter((f) => f.tipo === 'NCRE').reduce((s, f) => s + totalesVenta(f.lineas).total, 0)
  const porCobrar = facturas.reduce((s, f) => s + saldoFactura(f), 0)
  const borradores = facturas.filter((f) => f.estado === 'borrador').length
  const rutas = deAqui(estado.rutas, sucursalActiva).filter((r) => r.fecha === fechaGT())
  const sucursales = sucursalActiva === 'todas' ? estado.sucursales : estado.sucursales.filter((s) => s.id === sucursalActiva)
  const bajos = estado.productos.filter((p) => p.controlaInventario && p.activo).flatMap((p) => sucursales.map((s) => ({ producto: p, sucursal: s, cantidad: stock(estado, s.id, p.id) })).filter((x) => x.cantidad < p.minimo))

  const pasos = [
    ['Mirá los paneles en el mapa', '/rutas'],
    ['Abrí la handheld de Juan en otra ventana', '/reparto'],
    ['Facturá el pedido ya entregado del gimnasio', '/ventas'],
    ['Certificá el borrador y revisá el asiento', '/facturas'],
  ] as const

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-display text-4xl text-[#083844]">Hoy en Manantial</h1>
        <p className="mt-1 text-sm text-slate-600">Operación de demostración con series, IVA incluido y reparto en vivo. Nada de esto sale hacia la SAT.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Ventas del mes', quetzales(vendido - notas)],
          ['Por cobrar', quetzales(porCobrar)],
          ['Rutas de hoy', String(rutas.length)],
          ['Borradores FEL', String(borradores)],
        ].map(([titulo, valor]) => (
          <Tarjeta key={titulo}>
            <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{titulo}</div>
            <div className="font-display mt-2 text-3xl text-[#083844]">{valor}</div>
          </Tarjeta>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <Tarjeta>
          <h2 className="font-display text-2xl">Recorrido para la demo</h2>
          <ol className="mt-3 space-y-2 text-sm">
            {pasos.map(([texto, href], i) => (
              <li key={href} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                <span><strong className="mr-2 text-[#083844]">{i + 1}.</strong>{texto}</span>
                <Link className="shrink-0 font-medium text-cyan-800" to={href}>Abrir</Link>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-500">Para ver el mapa moverse al marcar una entrega, dejá esta sesión como administración y abrí otra ventana con juan.reparto@manantial.gt. Comparten los datos, no la sesión.</p>
        </Tarjeta>
        <Tarjeta>
          <h2 className="font-display text-2xl">Rutas de hoy</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {rutas.map((ruta) => {
              const repartidor = estado.usuarios.find((u) => u.id === ruta.repartidorId)
              const hechas = ruta.paradas.filter((p) => p.estado === 'entregada').length
              return (
                <li key={ruta.id} className="rounded-2xl bg-slate-50 px-3 py-2">
                  <div className="font-medium">{ruta.codigo} · {repartidor?.nombre}</div>
                  <div className="text-slate-500">{ruta.estado.replaceAll('_', ' ')} · {hechas}/{ruta.paradas.length} entregas · {ruta.vehiculo}</div>
                </li>
              )
            })}
          </ul>
        </Tarjeta>
      </div>
      <Tarjeta>
        <h2 className="font-display text-2xl">Existencia bajo el mínimo</h2>
        {bajos.length === 0 ? <p className="mt-2 text-sm text-slate-500">Las sucursales visibles están sobre el mínimo.</p> : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {bajos.slice(0, 6).map((b) => (
              <li key={b.producto.id + b.sucursal.id} className="rounded-2xl bg-amber-50 px-3 py-2 text-sm">
                {b.producto.nombre} · {b.sucursal.codigo}: {b.cantidad} (mínimo {b.producto.minimo})
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">Último movimiento de inventario registrado el {formatoFecha(estado.movimientos.at(-1)?.fecha ?? fechaGT())}.</p>
      </Tarjeta>
    </section>
  )
}
