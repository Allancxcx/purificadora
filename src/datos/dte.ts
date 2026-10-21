import { impuestoLinea, redondear } from '../dominio/calculos'
import { fechaHoraFel, nitLimpio } from '../dominio/formato'
import type { DteFel, Estado, Factura } from '../dominio/tipos'
import { serieActiva } from './consultas'

export type DteArmado = { ok: true; dte: DteFel } | { ok: false; error: string }

export function armarDte(estado: Estado, facturaId: string): DteArmado {
  const factura = estado.facturas.find((f) => f.id === facturaId)
  if (!factura) return { ok: false, error: 'No encontré la factura.' }
  if (factura.estado !== 'borrador') return { ok: false, error: 'Solo se certifica un borrador.' }
  const sucursal = estado.sucursales.find((s) => s.id === factura.sucursalId)
  const socio = estado.socios.find((s) => s.id === factura.socioId)
  if (!sucursal || !socio) return { ok: false, error: 'Falta la sucursal o el socio.' }
  const tipoSerie = factura.tipo === 'NCRE' ? 'NOTA_CREDITO' : 'FACTURA'
  const serie = serieActiva(estado, factura.sucursalId, tipoSerie)
  if (!serie) return { ok: false, error: 'No hay una serie activa para este documento en la sucursal.' }
  if (!serie.serieFel) return { ok: false, error: 'La serie fiscal no tiene código FEL.' }
  if (serie.correlativo > serie.hasta) return { ok: false, error: 'La serie llegó a su límite.' }

  let complemento: DteFel['complementoNota']
  if (factura.tipo === 'NCRE') {
    const origen = estado.facturas.find((f) => f.id === factura.facturaOrigenId)
    if (!origen?.acuse?.uuid) return { ok: false, error: 'La nota de crédito no tiene una factura certificada de origen.' }
    const serieOrigen = estado.series.find((s) => s.id === origen.serieId)
    complemento = {
      uuidOrigen: origen.acuse.uuid,
      fechaOrigen: origen.fecha,
      motivo: factura.motivo || 'Ajuste de la operación',
      serieOrigen: origen.acuse.serie || serieOrigen?.serieFel || '',
      numeroOrigen: origen.acuse.numero || String(origen.numero ?? ''),
    }
  }

  const idReceptor = nitLimpio(socio.nit)
  const items = factura.lineas.map((linea, indice) => {
    const precio = redondear(linea.cantidad * linea.precioUnitario)
    const impuesto = impuestoLinea(precio, linea.descuento, linea.gravable)
    return {
      numeroLinea: indice + 1,
      bienOServicio: linea.bienOServicio,
      cantidad: linea.cantidad,
      unidadMedida: linea.unidad.slice(0, 3),
      descripcion: linea.descripcion,
      precioUnitario: linea.precioUnitario,
      precio,
      descuento: redondear(linea.descuento),
      gravable: linea.gravable,
      montoGravable: impuesto.montoGravable,
      montoImpuesto: impuesto.montoImpuesto,
      total: impuesto.total,
    }
  })

  const frase: DteFel['frases'][number] = {
    tipo: estado.fel.fraseTipo,
    escenario: estado.fel.fraseEscenario,
  }
  if (estado.fel.fraseEscenario === 3 && estado.fel.numeroResolucion) {
    frase.numeroResolucion = estado.fel.numeroResolucion
    frase.fechaResolucion = estado.fel.fechaResolucion
  }

  return {
    ok: true,
    dte: {
      tipo: factura.tipo,
      fechaHoraEmision: fechaHoraFel(),
      moneda: 'GTQ',
      emisor: {
        nit: nitLimpio(estado.empresa.nit),
        nombre: estado.empresa.razonSocial,
        nombreComercial: estado.empresa.nombreComercial,
        establecimiento: sucursal.establecimientoSat,
        afiliacionIVA: estado.fel.afiliacionIVA,
        correo: estado.empresa.correo,
        direccion: {
          direccion: sucursal.direccion,
          codigoPostal: sucursal.codigoPostal,
          municipio: sucursal.municipio,
          departamento: sucursal.departamento,
          pais: 'GT',
        },
      },
      receptor: {
        id: idReceptor,
        nombre: socio.nombre,
        correo: socio.correo,
        tipoEspecial: /^\d{13}$/.test(idReceptor) ? 'CUI' : undefined,
        direccion: {
          direccion: socio.direccion || sucursal.direccion,
          codigoPostal: sucursal.codigoPostal,
          municipio: socio.municipio || sucursal.municipio,
          departamento: socio.departamento || sucursal.departamento,
          pais: 'GT',
        },
      },
      frases: [frase],
      items,
      totalIva: redondear(items.reduce((s, i) => s + i.montoImpuesto, 0)),
      granTotal: redondear(items.reduce((s, i) => s + i.total, 0)),
      complementoNota: complemento,
      serieEsperada: serie.serieFel,
      numeroEsperado: serie.correlativo,
    },
  }
}

export function xmlDeFactura(estado: Estado, factura: Factura): DteArmado {
  if (factura.dte) return { ok: true, dte: factura.dte }
  return armarDte(estado, factura.id)
}
