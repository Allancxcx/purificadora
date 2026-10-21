export type RolSocio = 'cliente' | 'proveedor' | 'lead'
export type TipoSerie = 'ORDEN_VENTA' | 'ORDEN_COMPRA' | 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO' | 'RECIBO'
export type TipoDte = 'FACT' | 'NCRE' | 'NDEB' | 'FCAM' | 'FPEQ' | 'RECI' | 'FESP'
export type EstadoOrdenVenta = 'borrador' | 'confirmada' | 'en_ruta' | 'entregada' | 'anulada'
export type EstadoOrdenCompra = 'borrador' | 'recibida' | 'anulada'
export type EstadoFactura = 'abierta' | 'cerrada' | 'cancelada'
export type EstadoRuta = 'planificada' | 'en_curso' | 'finalizada'
export type EstadoParada = 'pendiente' | 'en_camino' | 'llegada' | 'entregada' | 'incidencia'
export type OrigenInventario = 'ruta' | 'factura' | null
export type FormaCobro = 'efectivo' | 'transferencia' | 'tarjeta'
export type OrigenAsiento = 'apertura' | 'compra' | 'factura' | 'nota_credito' | 'nota_debito' | 'cancelacion' | 'cobro' | 'despacho' | 'devolucion_ruta' | 'manual'
export type ProveedorFel = 'simulado' | 'infile' | 'digifact' | 'g4s' | 'megaprint' | 'otro'
export type AfiliacionIVA = 'GEN' | 'PEQ' | 'PEE' | 'AGR' | 'AGE'

export interface Empresa {
  razonSocial: string
  nombreComercial: string
  nit: string
  correo: string
  telefono: string
  direccion: string
  municipio: string
  departamento: string
  codigoPostal: number
}

export interface ConfigFel {
  proveedor: ProveedorFel
  ambiente: 'pruebas' | 'produccion'
  afiliacionIVA: AfiliacionIVA
  fraseTipo: number
  fraseEscenario: number
  fraseTexto: string
  numeroResolucion: string
  fechaResolucion: string
  usuario: string
  token: string
  endpoint: string
}

export interface Sucursal {
  id: string
  codigo: string
  nombre: string
  establecimientoSat: number
  direccion: string
  municipio: string
  departamento: string
  codigoPostal: number
  telefono: string
  esMatriz: boolean
  activa: boolean
  lat: number
  lng: number
}

export interface Rol {
  id: string
  nombre: string
  descripcion: string
  alcance: 'empresa' | 'sucursal'
  esRepartidor: boolean
  sistema: boolean
  opciones: string[]
}

export interface Usuario {
  id: string
  nombre: string
  correo: string
  clave: string
  rolId: string
  sucursalId: string
  telefono: string
  activo: boolean
}

export interface Socio {
  id: string
  codigo: string
  nombre: string
  nombreComercial: string
  nit: string
  roles: RolSocio[]
  telefono: string
  correo: string
  direccion: string
  municipio: string
  departamento: string
  sucursalId: string
  lat: number | null
  lng: number | null
  limiteCredito: number
  diasCredito: number
  estado: 'activo' | 'inactivo'
  notas: string
}

export interface Producto {
  id: string
  sku: string
  nombre: string
  unidad: string
  bienOServicio: 'B' | 'S'
  precio: number
  costo: number
  gravable: boolean
  controlaInventario: boolean
  minimo: number
  activo: boolean
}

export interface SerieDocumento {
  id: string
  sucursalId: string
  tipo: TipoSerie
  prefijo: string
  serieFel: string
  resolucion: string
  correlativo: number
  hasta: number
  activa: boolean
}

export interface Cuenta {
  id: string
  codigo: string
  nombre: string
  tipo: 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'costo' | 'gasto'
}

export interface LineaComercial {
  id: string
  productoId: string
  descripcion: string
  bienOServicio: 'B' | 'S'
  unidad: string
  cantidad: number
  precioUnitario: number
  descuento: number
  costoUnitario: number
  gravable: boolean
  controlaInventario: boolean
}

export interface OrdenVenta {
  id: string
  sucursalId: string
  socioId: string
  vendedorId: string
  serieId: string
  numero: number
  fecha: string
  estado: EstadoOrdenVenta
  direccionEntrega: string
  lat: number
  lng: number
  ventana: string
  notas: string
  lineas: LineaComercial[]
  origenInventario: OrigenInventario
}

export interface LineaCompra {
  id: string
  productoId: string
  descripcion: string
  cantidad: number
  costoUnitario: number
  gravable: boolean
  controlaInventario: boolean
}

export interface OrdenCompra {
  id: string
  sucursalId: string
  socioId: string
  serieId: string
  numero: number
  fecha: string
  estado: EstadoOrdenCompra
  notas: string
  lineas: LineaCompra[]
  asientoId?: string
}

export interface AcuseFel {
  resultado: boolean
  uuid: string | null
  serie: string | null
  numero: string | null
  fechaCertificacion: string | null
  errores: { codigo: string; mensaje: string }[]
}

export interface DireccionFel {
  direccion: string
  codigoPostal: number
  municipio: string
  departamento: string
  pais: 'GT'
}

export interface ItemFel {
  numeroLinea: number
  bienOServicio: 'B' | 'S'
  cantidad: number
  unidadMedida: string
  descripcion: string
  precioUnitario: number
  precio: number
  descuento: number
  gravable: boolean
  montoGravable: number
  montoImpuesto: number
  total: number
}

export interface DteFel {
  tipo: TipoDte
  fechaHoraEmision: string
  moneda: 'GTQ'
  emisor: {
    nit: string
    nombre: string
    nombreComercial: string
    establecimiento: number
    afiliacionIVA: AfiliacionIVA
    correo: string
    direccion: DireccionFel
  }
  receptor: {
    id: string
    nombre: string
    correo: string
    tipoEspecial?: 'CUI' | 'EXT'
    direccion: DireccionFel
  }
  frases: { tipo: number; escenario: number; numeroResolucion?: string; fechaResolucion?: string }[]
  items: ItemFel[]
  totalIva: number
  granTotal: number
  complementoNota?: {
    uuidOrigen: string
    fechaOrigen: string
    motivo: string
    serieOrigen: string
    numeroOrigen: string
  }
  serieEsperada: string
  numeroEsperado: number
}

export interface Cobro {
  id: string
  fecha: string
  monto: number
  serieId: string
  numero: number
  forma: FormaCobro
  referencia: string
  asientoId: string
}

export interface Factura {
  id: string
  tipo: 'FACT' | 'NCRE' | 'NDEB'
  sucursalId: string
  socioId: string
  ordenVentaId?: string
  facturaOrigenId?: string
  serieId: string
  numero: number | null
  fecha: string
  estado: EstadoFactura
  lineas: LineaComercial[]
  motivo: string
  acuse: AcuseFel | null
  dte: DteFel | null
  cobros: Cobro[]
  asientoId?: string
  ultimoError?: string
  movioInventario: boolean
  ajustada: boolean
}

export interface LineaAsiento {
  cuentaId: string
  detalle: string
  debe: number
  haber: number
}

export interface Asiento {
  id: string
  numero: number
  fecha: string
  descripcion: string
  origen: OrigenAsiento
  origenId?: string
  sucursalId: string
  lineas: LineaAsiento[]
}

export interface MovimientoInventario {
  id: string
  fecha: string
  sucursalId: string
  productoId: string
  tipo: 'entrada' | 'salida'
  cantidad: number
  referencia: string
  concepto: string
}

export interface Parada {
  id: string
  ordenVentaId: string
  socioId: string
  nombre: string
  direccion: string
  telefono: string
  lat: number
  lng: number
  ventana: string
  resumen: string
  estado: EstadoParada
  incidencia: string
  entregadaEn?: string
}

export interface Ruta {
  id: string
  codigo: string
  fecha: string
  sucursalId: string
  repartidorId: string
  vehiculo: string
  estado: EstadoRuta
  paradas: Parada[]
  iniciadaEn?: string
  legStartedAt?: string
  asientoCostoId?: string
  gps?: { lat: number; lng: number; en: string }
}

export interface Estado {
  version: 1
  empresa: Empresa
  fel: ConfigFel
  sucursales: Sucursal[]
  roles: Rol[]
  usuarios: Usuario[]
  socios: Socio[]
  productos: Producto[]
  series: SerieDocumento[]
  cuentas: Cuenta[]
  ordenesVenta: OrdenVenta[]
  ordenesCompra: OrdenCompra[]
  facturas: Factura[]
  asientos: Asiento[]
  movimientos: MovimientoInventario[]
  rutas: Ruta[]
  siguienteAsiento: number
  siguienteRuta: number
}
