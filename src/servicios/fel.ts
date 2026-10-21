import type { ConfigFel, DteFel, ProveedorFel } from '../dominio/tipos'
import { monto } from '../dominio/calculos'

export interface ResultadoPrueba {
  ok: boolean
  mensaje: string
}

/**
 * Contrato estable del certificador.
 * La demo implementa `simulado`. INFILE, Digifact, G4S o Megaprint
 * se conectan reemplazando este adaptador: reciben un DteFel ya calculado
 * y devuelven el acuse. La firma XAdES la agrega el certificador.
 */
export interface CertificadorFel {
  readonly codigo: ProveedorFel
  probar(): Promise<ResultadoPrueba>
  certificar(dte: DteFel): Promise<import('../dominio/tipos').AcuseFel>
}

function esperar(ms: number) {
  return new Promise((resolver) => setTimeout(resolver, ms))
}

function xml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function dteAXml(dte: DteFel): string {
  const frases = dte.frases
    .map((f) => {
      const extra = [
        f.numeroResolucion ? ` NumeroResolucion="${xml(f.numeroResolucion)}"` : '',
        f.fechaResolucion ? ` FechaResolucion="${xml(f.fechaResolucion)}"` : '',
      ].join('')
      return `        <dte:Frase TipoFrase="${f.tipo}" CodigoEscenario="${f.escenario}"${extra}/>`
    })
    .join('\n')

  const items = dte.items
    .map((item) => {
      const impuesto = item.gravable
        ? `<dte:Impuestos>
            <dte:Impuesto>
              <dte:NombreCorto>IVA</dte:NombreCorto>
              <dte:CodigoUnidadGravable>1</dte:CodigoUnidadGravable>
              <dte:MontoGravable>${monto(item.montoGravable)}</dte:MontoGravable>
              <dte:MontoImpuesto>${monto(item.montoImpuesto)}</dte:MontoImpuesto>
            </dte:Impuesto>
          </dte:Impuestos>`
        : `<dte:Impuestos>
            <dte:Impuesto>
              <dte:NombreCorto>IVA</dte:NombreCorto>
              <dte:CodigoUnidadGravable>2</dte:CodigoUnidadGravable>
              <dte:MontoGravable>${monto(item.montoGravable)}</dte:MontoGravable>
              <dte:MontoImpuesto>0.00</dte:MontoImpuesto>
            </dte:Impuesto>
          </dte:Impuestos>`
      return `        <dte:Item BienOServicio="${item.bienOServicio}" NumeroLinea="${item.numeroLinea}">
          <dte:Cantidad>${monto(item.cantidad)}</dte:Cantidad>
          <dte:UnidadMedida>${xml(item.unidadMedida)}</dte:UnidadMedida>
          <dte:Descripcion>${xml(item.descripcion)}</dte:Descripcion>
          <dte:PrecioUnitario>${monto(item.precioUnitario)}</dte:PrecioUnitario>
          <dte:Precio>${monto(item.precio)}</dte:Precio>
          <dte:Descuento>${monto(item.descuento)}</dte:Descuento>
          ${impuesto}
          <dte:Total>${monto(item.total)}</dte:Total>
        </dte:Item>`
    })
    .join('\n')

  const nota = dte.complementoNota
    ? `
        <dte:Complementos>
          <dte:Complemento IDComplemento="Notas" NombreComplemento="Notas" URIComplemento="http://www.sat.gob.gt/face2/ComplementoReferenciaNota/0.1.0">
            <cno:ReferenciasNota xmlns:cno="http://www.sat.gob.gt/face2/ComplementoReferenciaNota/0.1.0" Version="0.0" NumeroAutorizacionDocumentoOrigen="${xml(dte.complementoNota.uuidOrigen)}" FechaEmisionDocumentoOrigen="${xml(dte.complementoNota.fechaOrigen)}" MotivoAjuste="${xml(dte.complementoNota.motivo)}" SerieDocumentoOrigen="${xml(dte.complementoNota.serieOrigen)}" NumeroDocumentoOrigen="${xml(dte.complementoNota.numeroOrigen)}"/>
          </dte:Complemento>
        </dte:Complementos>`
    : ''

  const tipoEspecial = dte.receptor.tipoEspecial ? ` TipoEspecial="${dte.receptor.tipoEspecial}"` : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<dte:GTDocumento xmlns:dte="http://www.sat.gob.gt/dte/fel/0.2.0" Version="0.1">
  <dte:SAT ClaseDocumento="dte">
    <dte:DTE ID="DatosCertificados">
      <dte:DatosEmision ID="DatosEmision">
        <dte:DatosGenerales CodigoMoneda="${dte.moneda}" FechaHoraEmision="${xml(dte.fechaHoraEmision)}" Tipo="${dte.tipo}"/>
        <dte:Emisor AfiliacionIVA="${dte.emisor.afiliacionIVA}" CodigoEstablecimiento="${dte.emisor.establecimiento}"${dte.emisor.correo ? ` CorreoEmisor="${xml(dte.emisor.correo)}"` : ''} NITEmisor="${xml(dte.emisor.nit)}" NombreComercial="${xml(dte.emisor.nombreComercial)}" NombreEmisor="${xml(dte.emisor.nombre)}">
          <dte:DireccionEmisor>
            <dte:Direccion>${xml(dte.emisor.direccion.direccion)}</dte:Direccion>
            <dte:CodigoPostal>${dte.emisor.direccion.codigoPostal}</dte:CodigoPostal>
            <dte:Municipio>${xml(dte.emisor.direccion.municipio)}</dte:Municipio>
            <dte:Departamento>${xml(dte.emisor.direccion.departamento)}</dte:Departamento>
            <dte:Pais>GT</dte:Pais>
          </dte:DireccionEmisor>
        </dte:Emisor>
        <dte:Receptor${dte.receptor.correo ? ` CorreoReceptor="${xml(dte.receptor.correo)}"` : ''} IDReceptor="${xml(dte.receptor.id)}" NombreReceptor="${xml(dte.receptor.nombre)}"${tipoEspecial}>
          <dte:DireccionReceptor>
            <dte:Direccion>${xml(dte.receptor.direccion.direccion)}</dte:Direccion>
            <dte:CodigoPostal>${dte.receptor.direccion.codigoPostal}</dte:CodigoPostal>
            <dte:Municipio>${xml(dte.receptor.direccion.municipio)}</dte:Municipio>
            <dte:Departamento>${xml(dte.receptor.direccion.departamento)}</dte:Departamento>
            <dte:Pais>GT</dte:Pais>
          </dte:DireccionReceptor>
        </dte:Receptor>
        <dte:Frases>
${frases}
        </dte:Frases>
        <dte:Items>
${items}
        </dte:Items>
        <dte:Totales>
          <dte:TotalImpuestos>
            <dte:TotalImpuesto NombreCorto="IVA" TotalMontoImpuesto="${monto(dte.totalIva)}"/>
          </dte:TotalImpuestos>
          <dte:GranTotal>${monto(dte.granTotal)}</dte:GranTotal>
        </dte:Totales>${nota}
      </dte:DatosEmision>
    </dte:DTE>
  </dte:SAT>
</dte:GTDocumento>
`
}

class CertificadorSimulado implements CertificadorFel {
  readonly codigo = 'simulado' as const

  async probar(): Promise<ResultadoPrueba> {
    await esperar(350)
    return { ok: true, mensaje: 'Ambiente de demostración listo. No se contactó a la SAT ni a un certificador.' }
  }

  async certificar(dte: DteFel) {
    await esperar(700)
    const nit = dte.receptor.id.replace(/-/g, '').toUpperCase()
    if (nit === '99999999') {
      return {
        resultado: false,
        uuid: null,
        serie: null,
        numero: null,
        fechaCertificacion: null,
        errores: [{ codigo: 'SAT-NIT', mensaje: 'Error. El NIT del receptor no es válido.' }],
      }
    }
    return {
      resultado: true,
      uuid: crypto.randomUUID().toUpperCase(),
      serie: dte.serieEsperada,
      numero: String(dte.numeroEsperado),
      fechaCertificacion: new Date().toISOString(),
      errores: [],
    }
  }
}

class CertificadorPendiente implements CertificadorFel {
  readonly codigo: ProveedorFel
  constructor(private config: ConfigFel) {
    this.codigo = config.proveedor
  }

  async probar(): Promise<ResultadoPrueba> {
    return {
      ok: false,
      mensaje: `${this.config.proveedor} todavía no tiene adaptador. El DTE ya está armado: falta el POST al certificador y traducir su respuesta al acuse.`,
    }
  }

  async certificar(): Promise<import('../dominio/tipos').AcuseFel> {
    return {
      resultado: false,
      uuid: null,
      serie: null,
      numero: null,
      fechaCertificacion: null,
      errores: [{
        codigo: 'SIN_ADAPTADOR',
        mensaje: `El certificador "${this.config.proveedor}" no está integrado. Implementá CertificadorFel en src/servicios/fel.ts. El XML del documento ya se puede descargar.`,
      }],
    }
  }
}

export function crearCertificador(config: ConfigFel): CertificadorFel {
  if (config.proveedor === 'simulado') return new CertificadorSimulado()
  return new CertificadorPendiente(config)
}
