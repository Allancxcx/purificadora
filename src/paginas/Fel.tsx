import { useState } from 'react'
import { useErp } from '../datos/store'
import { guardarDatosFiscales } from '../datos/motor'
import { armarDte } from '../datos/dte'
import { FRASES_ISR, PROVEEDORES_FEL } from '../dominio/permisos'
import type { AfiliacionIVA, ProveedorFel } from '../dominio/tipos'
import { dteAXml } from '../servicios/fel'
import { Badge, Boton, Campo, Lista, Pagina, Tarjeta, Texto } from '../componentes/ui'

export function Fel() {
  const { estado, puede, ejecutar, probarFel } = useErp()
  const [config, setConfig] = useState(estado.fel)
  const [emisor, setEmisor] = useState({
    razonSocial: estado.empresa.razonSocial,
    nombreComercial: estado.empresa.nombreComercial,
    nit: estado.empresa.nit,
  })
  const borrador = estado.facturas.find((f) => f.estado === 'abierta')
  const muestra = borrador ? armarDte(estado, borrador.id) : null
  const xml = muestra?.ok ? dteAXml(muestra.dte) : ''

  return (
    <Pagina titulo="Certificación FEL" detalle="Manantial arma el DTE de la SAT. El certificador solo firma, transmite y devuelve el UUID. Hoy responde un simulador para que la demo no dependa de un contrato.">
      <div className="grid gap-3 lg:grid-cols-2">
        <Tarjeta className="space-y-3">
          <div className="flex items-center gap-2"><h2 className="font-display text-2xl">Emisor y certificador</h2><Badge tono={config.proveedor === 'simulado' ? 'alerta' : 'agua'}>{config.ambiente}</Badge></div>
          <Campo etiqueta="Razón social"><Texto value={emisor.razonSocial} disabled={!puede('fel.configurar')} onChange={(e) => setEmisor({ ...emisor, razonSocial: e.target.value })} /></Campo>
          <Campo etiqueta="Nombre comercial"><Texto value={emisor.nombreComercial} disabled={!puede('fel.configurar')} onChange={(e) => setEmisor({ ...emisor, nombreComercial: e.target.value })} /></Campo>
          <Campo etiqueta="NIT"><Texto value={emisor.nit} disabled={!puede('fel.configurar')} onChange={(e) => setEmisor({ ...emisor, nit: e.target.value })} /></Campo>
          <Campo etiqueta="Proveedor">
            <Lista value={config.proveedor} onChange={(e) => setConfig({ ...config, proveedor: e.target.value as ProveedorFel })} disabled={!puede('fel.configurar')}>
              {PROVEEDORES_FEL.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Lista>
          </Campo>
          <Campo etiqueta="Ambiente">
            <Lista value={config.ambiente} onChange={(e) => setConfig({ ...config, ambiente: e.target.value as 'pruebas' | 'produccion' })} disabled={!puede('fel.configurar')}>
              <option value="pruebas">Pruebas</option>
              <option value="produccion">Producción</option>
            </Lista>
          </Campo>
          <Campo etiqueta="Afiliación IVA">
            <Lista value={config.afiliacionIVA} onChange={(e) => setConfig({ ...config, afiliacionIVA: e.target.value as AfiliacionIVA })} disabled={!puede('fel.configurar')}>
              <option value="GEN">General</option>
              <option value="PEQ">Pequeño contribuyente</option>
              <option value="PEE">Pequeño contribuyente electrónico</option>
            </Lista>
          </Campo>
          <Campo etiqueta="Frase ISR">
            <Lista value={String(config.fraseEscenario)} onChange={(e) => {
              const frase = FRASES_ISR.find((f) => f.escenario === Number(e.target.value))!
              setConfig({ ...config, fraseTipo: frase.tipo, fraseEscenario: frase.escenario, fraseTexto: frase.texto })
            }} disabled={!puede('fel.configurar')}>
              {FRASES_ISR.map((f) => <option key={f.escenario} value={f.escenario}>{f.texto}</option>)}
            </Lista>
          </Campo>
          <Campo etiqueta="Usuario del certificador"><Texto value={config.usuario} onChange={(e) => setConfig({ ...config, usuario: e.target.value })} disabled={!puede('fel.configurar')} /></Campo>
          <Campo etiqueta="Token"><Texto type="password" value={config.token} onChange={(e) => setConfig({ ...config, token: e.target.value })} disabled={!puede('fel.configurar')} /></Campo>
          <Campo etiqueta="Endpoint"><Texto value={config.endpoint} placeholder="https://certificador/api" onChange={(e) => setConfig({ ...config, endpoint: e.target.value })} disabled={!puede('fel.configurar')} /></Campo>
          <div className="flex gap-2">
            {puede('fel.configurar') && <Boton onClick={() => ejecutar((e) => guardarDatosFiscales(e, emisor, config))}>Guardar</Boton>}
            <Boton variante="secundario" onClick={() => probarFel()}>Probar conexión</Boton>
          </div>
          <p className="text-xs text-slate-500">En producción el token no vive en el navegador. El API guarda la llave y el navegador solo pide certificar. Un NIT 9999999-9 hace que el simulador rechace el documento.</p>
        </Tarjeta>
        <Tarjeta className="space-y-3">
          <h2 className="font-display text-2xl">Qué se certifica</h2>
          <ul className="space-y-2 text-sm text-slate-700">
            <li>Factura (FACT) y nota de crédito (NCRE). La cambiaria, el recibo FEL y la factura especial ya están en el catálogo de tipos, sin pantalla todavía.</li>
            <li>IVA incluido: base = precio / 1.12 y el total del ítem no vuelve a sumar el impuesto.</li>
            <li>Frase tipo 1, establecimiento de la sucursal y NIT sin guiones.</li>
            <li>La nota de crédito lleva el complemento de referencia al UUID de origen.</li>
            <li>La firma XAdES la agrega el certificador. El XML que descargás es el DTE de entrada, sin firma.</li>
          </ul>
          <p className="text-sm">El adaptador está en <code>src/servicios/fel.ts</code>. Implementás <code>certificar(dte)</code> y devolvés el acuse. La contabilidad no cambia.</p>
          {xml && (
            <>
              <h3 className="text-sm font-semibold">Vista del próximo documento abierto</h3>
              <pre className="max-h-80 overflow-auto rounded bg-[#083844] p-3 text-[11px] leading-relaxed text-cyan-50">{xml}</pre>
            </>
          )}
        </Tarjeta>
      </div>
    </Pagina>
  )
}
