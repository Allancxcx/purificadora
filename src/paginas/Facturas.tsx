import { useState } from 'react'
import { useErp } from '../datos/store'
import { armarDte } from '../datos/dte'
import { anularConCertificador, cancelarDocumento, emitirNota, registrarCobro } from '../datos/motor'
import { folio, saldoFactura } from '../datos/consultas'
import { totalesVenta } from '../dominio/calculos'
import { quetzales } from '../dominio/formato'
import type { EstadoFactura, FormaCobro } from '../dominio/tipos'
import { dteAXml } from '../servicios/fel'
import { FacturaVista } from '../componentes/FacturaVista'
import { Badge, Boton, Campo, Lista, Modal, Pagina, Tabla, Texto } from '../componentes/ui'

const ETIQUETA: Record<EstadoFactura, string> = { abierta: 'Abierta', cerrada: 'Cerrada', cancelada: 'Cancelada' }
const TIPO: Record<string, string> = { FACT: 'Factura', NCRE: 'Nota de crédito', NDEB: 'Nota de débito' }

export function Facturas() {
  const { estado, sucursalActiva, puede, ejecutar, certificar, certificando } = useErp()
  const [vista, setVista] = useState<string | null>(null)
  const [cobro, setCobro] = useState<string | null>(null)
  const [monto, setMonto] = useState(0)
  const [forma, setForma] = useState<FormaCobro>('transferencia')
  const [referencia, setReferencia] = useState('')
  const [ajuste, setAjuste] = useState<null | { id: string; modo: 'credito' | 'debito' | 'anular' }>(null)
  const [motivo, setMotivo] = useState('')
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

  function pedir(id: string, modo: 'credito' | 'debito' | 'anular') {
    setAjuste({ id, modo })
    setMotivo(modo === 'debito' ? 'Ajuste a cargo del cliente' : modo === 'credito' ? 'Anulación de la factura' : 'Anulación ante el certificador')
  }

  return (
    <Pagina titulo="Facturas" detalle="Abierta al crearla. Cerrada cuando el certificador acepta. Si sigue abierta, se cancela aquí. Si ya está cerrada, la anula el servicio del certificador o una nota de crédito. La nota de débito no anula: aumenta lo que el cliente debe, y no aplica a una factura de proveedor.">
      <Tabla
        id="facturas"
        columnas={[
          { id: 'documento', titulo: 'Documento' },
          { id: 'tipo', titulo: 'Tipo' },
          { id: 'cliente', titulo: 'Cliente' },
          { id: 'estado', titulo: 'Estado' },
          { id: 'total', titulo: 'Total' },
          { id: 'saldo', titulo: 'Saldo' },
          { id: 'acciones', titulo: 'Acciones', fija: true },
        ]}
        vacio="No hay facturas en esta sucursal. Facturá una orden de venta."
        filas={facturas.map((factura) => {
          const serie = estado.series.find((s) => s.id === factura.serieId)
          const numero = factura.numero ? folio(serie?.prefijo ?? 'FAC', factura.numero) : 'Sin número'
          const cliente = estado.socios.find((s) => s.id === factura.socioId)
          const tieneNota = estado.facturas.some((f) => f.facturaOrigenId === factura.id && f.estado !== 'cancelada')
          const notaCreditoPendiente = estado.facturas.some((f) => f.facturaOrigenId === factura.id && f.tipo === 'NCRE' && f.estado !== 'cancelada')
          const facturaDeCliente = factura.tipo === 'FACT' && Boolean(factura.ordenVentaId) && Boolean(cliente?.roles.includes('cliente'))
          const puedeAjustar = puede('facturas.emitir') && facturaDeCliente && factura.estado === 'cerrada' && !factura.ajustada && !tieneNota
          const sinCobros = factura.cobros.length === 0
          return {
            id: factura.id,
            celdas: [
              numero,
              TIPO[factura.tipo],
              estado.socios.find((s) => s.id === factura.socioId)?.nombre,
              <span key="e">
                <Badge tono={factura.estado === 'cerrada' ? 'ok' : factura.estado === 'cancelada' ? 'peligro' : 'alerta'}>{factura.ajustada ? 'Ajustada' : ETIQUETA[factura.estado]}</Badge>
                {factura.ultimoError && <div className="mt-1 max-w-xs text-xs text-rose-700">{factura.ultimoError}</div>}
              </span>,
              quetzales(totalesVenta(factura.lineas).total),
              quetzales(saldoFactura(factura)),
              <span key="a" className="flex flex-wrap gap-1">
                <Boton variante="secundario" onClick={() => setVista(factura.id)}>Ver</Boton>
                <Boton variante="secundario" onClick={() => descargar(factura.id)}>XML</Boton>
                {puede('facturas.emitir') && factura.estado === 'abierta' && <Boton disabled={certificando === factura.id} onClick={() => certificar(factura.id)}>{certificando === factura.id ? 'Certificando…' : 'Certificar'}</Boton>}
                {puede('facturas.cobrar') && saldoFactura(factura) > 0 && !notaCreditoPendiente && <Boton variante="secundario" onClick={() => { setCobro(factura.id); setMonto(saldoFactura(factura)); setReferencia('') }}>Cobrar</Boton>}
                {puedeAjustar && sinCobros && <Boton variante="secundario" onClick={() => pedir(factura.id, 'anular')}>Anular</Boton>}
                {puedeAjustar && sinCobros && <Boton variante="secundario" onClick={() => pedir(factura.id, 'credito')}>Nota de crédito</Boton>}
                {puedeAjustar && <Boton variante="secundario" onClick={() => pedir(factura.id, 'debito')}>Débito al cliente</Boton>}
                {puede('facturas.emitir') && factura.estado === 'abierta' && <Boton variante="peligro" onClick={() => ejecutar((e) => cancelarDocumento(e, factura.id))}>Cancelar</Boton>}
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
      <Modal
        titulo={ajuste?.modo === 'debito' ? 'Nota de débito al cliente' : ajuste?.modo === 'credito' ? 'Nota de crédito' : 'Anular con el certificador'}
        abierto={Boolean(ajuste)}
        onCerrar={() => setAjuste(null)}
        ancho="max-w-md"
      >
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault()
          if (!ajuste) return
          const resultado = ejecutar((actual) => {
            if (ajuste.modo === 'anular') return anularConCertificador(actual, ajuste.id, motivo)
            return emitirNota(actual, ajuste.id, ajuste.modo === 'credito' ? 'NCRE' : 'NDEB', motivo)
          })
          if (resultado.ok) setAjuste(null)
        }}>
          <p className="text-sm text-slate-600">
            {ajuste?.modo === 'anular'
              ? 'La factura ya está cerrada. Este paso llama al servicio de anulación del certificador, revierte el asiento y la deja cancelada. No crea una nota de crédito.'
              : ajuste?.modo === 'debito'
                ? 'La emitimos nosotros y aumenta lo que el cliente nos debe. No anula la factura y no sirve para una factura de proveedor.'
                : 'Esta nota anula el efecto de la factura del cliente. Queda abierta hasta certificarla: ahí se reversa venta, IVA y, si la factura movió inventario, el producto regresa. La factura original queda ajustada y con saldo cero.'}
          </p>
          <Campo etiqueta="Motivo"><Texto value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
          <Boton type="submit">{ajuste?.modo === 'anular' ? 'Anular documento' : 'Crear nota'}</Boton>
        </form>
      </Modal>
    </Pagina>
  )
}
