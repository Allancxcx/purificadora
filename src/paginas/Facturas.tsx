import { useState } from 'react'
import { useErp } from '../datos/store'
import { armarDte } from '../datos/dte'
import { descartarBorrador, emitirNotaCredito, registrarCobro } from '../datos/motor'
import { folio, saldoFactura } from '../datos/consultas'
import { totalesVenta } from '../dominio/calculos'
import { quetzales } from '../dominio/formato'
import type { FormaCobro } from '../dominio/tipos'
import { dteAXml } from '../servicios/fel'
import { FacturaVista } from '../componentes/FacturaVista'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Texto } from '../componentes/ui'

export function Facturas() {
  const { estado, sucursalActiva, puede, ejecutar, certificar, certificando } = useErp()
  const [vista, setVista] = useState<string | null>(null)
  const [cobro, setCobro] = useState<string | null>(null)
  const [monto, setMonto] = useState(0)
  const [forma, setForma] = useState<FormaCobro>('transferencia')
  const [referencia, setReferencia] = useState('')
  const facturas = estado.facturas.filter((f) => sucursalActiva === 'todas' || f.sucursalId === sucursalActiva)
  const abierta = facturas.find((f) => f.id === vista)

  function descargar(id: string) {
    const factura = estado.facturas.find((f) => f.id === id)
    if (!factura) return
    const armado = factura.dte ? { ok: true as const, dte: factura.dte } : armarDte(estado, id)
    if (!armado.ok) return
    const blob = new Blob([dteAXml(armado.dte)], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `${factura.tipo}-${factura.id}.xml`
    enlace.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Pagina titulo="Facturas" detalle="Certificar asigna el correlativo, arma el DTE y, si el certificador acepta, registra clientes, ventas, IVA y el costo de mostrador.">
      <Tabla
        columnas={['Documento', 'Tipo', 'Cliente', 'Estado', 'Total', 'Saldo', '']}
        vacio="No hay facturas en esta sucursal. Facturá una orden de venta."
        filas={facturas.map((factura) => {
          const serie = estado.series.find((s) => s.id === factura.serieId)
          const numero = factura.numero ? folio(serie?.prefijo ?? 'FAC', factura.numero) : 'Borrador'
          return {
            id: factura.id,
            celdas: [
              numero,
              factura.tipo,
              estado.socios.find((s) => s.id === factura.socioId)?.nombre,
              <span key="e"><Badge tono={factura.estado === 'certificada' ? 'ok' : factura.estado === 'anulada' ? 'peligro' : 'alerta'}>{factura.ajustada ? 'ajustada' : factura.estado}</Badge>{factura.ultimoError && <div className="mt-1 max-w-xs text-xs text-rose-700">{factura.ultimoError}</div>}</span>,
              quetzales(totalesVenta(factura.lineas).total),
              quetzales(saldoFactura(factura)),
              <span key="a" className="flex flex-wrap gap-1">
                <Boton variante="secundario" onClick={() => setVista(factura.id)}>Ver</Boton>
                <Boton variante="secundario" onClick={() => descargar(factura.id)}>XML</Boton>
                {puede('facturas.emitir') && factura.estado === 'borrador' && <Boton disabled={certificando === factura.id} onClick={() => certificar(factura.id)}>{certificando === factura.id ? 'Certificando…' : 'Certificar'}</Boton>}
                {puede('facturas.cobrar') && saldoFactura(factura) > 0 && <Boton variante="secundario" onClick={() => { setCobro(factura.id); setMonto(saldoFactura(factura)); setReferencia('') }}>Cobrar</Boton>}
                {puede('facturas.emitir') && factura.tipo === 'FACT' && factura.estado === 'certificada' && !factura.ajustada && factura.cobros.length === 0 && <Boton variante="peligro" onClick={() => ejecutar((e) => emitirNotaCredito(e, factura.id, 'Anulación de la operación'))}>Nota de crédito</Boton>}
                {puede('facturas.emitir') && factura.estado === 'borrador' && <Boton variante="fantasma" onClick={() => ejecutar((e) => descartarBorrador(e, factura.id))}>Descartar</Boton>}
              </span>,
            ],
          }
        })}
      />
      {abierta && <FacturaVista estado={estado} factura={abierta} onCerrar={() => setVista(null)} />}
      <Modal titulo="Registrar cobro" abierto={Boolean(cobro)} onCerrar={() => setCobro(null)}>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault()
          if (!cobro) return
          const resultado = ejecutar((estadoActual) => registrarCobro(estadoActual, cobro, monto, forma, referencia))
          if (resultado.ok) setCobro(null)
        }}>
          <Campo etiqueta="Monto"><Texto type="number" step="0.01" value={monto} onChange={(e) => setMonto(Number(e.target.value))} /></Campo>
          <Campo etiqueta="Forma">
            <Lista value={forma} onChange={(e) => setForma(e.target.value as FormaCobro)}>
              <option value="efectivo">Efectivo (caja)</option>
              <option value="transferencia">Transferencia (bancos)</option>
              <option value="tarjeta">Tarjeta (bancos)</option>
            </Lista>
          </Campo>
          <Campo etiqueta="Referencia"><Texto value={referencia} onChange={(e) => setReferencia(e.target.value)} /></Campo>
          <Boton type="submit">Registrar recibo</Boton>
        </form>
      </Modal>
    </Pagina>
  )
}
