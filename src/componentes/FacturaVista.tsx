import { impuestoLinea, totalesVenta } from '../dominio/calculos'
import { formatoFecha, formatoFechaHora, quetzales } from '../dominio/formato'
import type { Estado, Factura } from '../dominio/tipos'
import { Boton } from './ui'

export function FacturaVista({ estado, factura, onCerrar }: { estado: Estado; factura: Factura; onCerrar: () => void }) {
  const socio = estado.socios.find((s) => s.id === factura.socioId)
  const sucursal = estado.sucursales.find((s) => s.id === factura.sucursalId)
  const serie = estado.series.find((s) => s.id === factura.serieId)
  const totales = totalesVenta(factura.lineas)
  const titulo = factura.tipo === 'NCRE' ? 'Nota de crédito' : 'Factura'
  return (
    <div className="fixed inset-0 z-[70] overflow-auto bg-[#083844]/50 p-4">
      <div className="factura-impresion mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="no-imprimir mb-4 flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => window.print()}>Imprimir</Boton>
          <Boton variante="fantasma" onClick={onCerrar}>Cerrar</Boton>
        </div>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="font-display text-3xl text-[#083844]">{estado.empresa.nombreComercial}</div>
            <div className="text-sm">{estado.empresa.razonSocial}</div>
            <div className="text-sm text-slate-600">NIT {estado.empresa.nit}</div>
            <div className="text-sm text-slate-600">{estado.empresa.direccion}</div>
            <div className="text-sm text-slate-600">{estado.empresa.telefono}</div>
            <div className="text-sm text-slate-600">{sucursal?.direccion}</div>
            <div className="text-sm text-slate-600">Establecimiento {sucursal?.establecimientoSat} · {sucursal?.nombre}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{titulo}</div>
            <div className="font-display text-2xl">{factura.acuse?.serie || serie?.serieFel || '—'} {factura.acuse?.numero || (factura.numero ? String(factura.numero) : 'Borrador')}</div>
            <div className="text-sm">{formatoFecha(factura.fecha)}</div>
          </div>
        </div>
        <p className="mt-3 text-sm font-medium">{estado.fel.fraseTexto}</p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Receptor</div>
            <div className="font-medium">{socio?.nombre}</div>
            <div>NIT {socio?.nit}</div>
            <div>{factura.lineas.length ? socio?.direccion : ''}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Autorización</div>
            <div className="break-all font-medium">{factura.acuse?.uuid ?? 'Pendiente de certificador'}</div>
            {factura.acuse?.fechaCertificacion && <div>{formatoFechaHora(factura.acuse.fechaCertificacion)}</div>}
            {serie && <div>Serie interna {serie.prefijo}</div>}
          </div>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="py-2">Cant.</th><th>Descripción</th><th className="text-right">Precio</th><th className="text-right">Total</th></tr>
          </thead>
          <tbody>
            {factura.lineas.map((linea) => {
              const precio = linea.cantidad * linea.precioUnitario
              const impuesto = impuestoLinea(precio, linea.descuento, linea.gravable)
              return (
                <tr key={linea.id} className="border-t border-slate-100">
                  <td className="py-2">{linea.cantidad}</td>
                  <td>{linea.descripcion}</td>
                  <td className="text-right">{quetzales(linea.precioUnitario)}</td>
                  <td className="text-right">{quetzales(impuesto.total)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span>Ventas</span><span>{quetzales(totales.total - totales.iva)}</span></div>
          <div className="flex justify-between"><span>IVA 12%</span><span>{quetzales(totales.iva)}</span></div>
          <div className="flex justify-between border-t border-slate-200 pt-2 font-display text-xl"><span>Total</span><span>{quetzales(totales.total)}</span></div>
        </div>
        {factura.motivo && <p className="mt-4 text-sm">Motivo: {factura.motivo}</p>}
        <p className="mt-6 text-xs text-slate-500">Representación de demostración. No tiene validez tributaria: el UUID simulado no existe en la SAT. El XML descargable es el DTE que un certificador firmaría y transmitiría.</p>
      </div>
    </div>
  )
}
