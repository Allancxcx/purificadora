/**
 * Contrato previsto para sustituir el repositorio del navegador.
 * La demo no levanta este API: cada función de src/datos/motor.ts
 * es un caso de uso que el backend puede exponer igual.
 *
 * Certificar es el único llamado lento. En producción conviene una cola:
 * el API reserva el correlativo, publica el DTE al certificador y,
 * al volver el acuse, corre aplicarCertificacion. Si el proceso cae,
 * el borrador sigue y el reintento no duplica el asiento porque solo
 * certifica estado "abierta".
 */
export const ENDPOINTS = [
  ['POST', '/api/sesion', 'entrar'],
  ['GET', '/api/estado', 'lectura del tablero según rol y sucursal'],
  ['POST', '/api/empresa', 'guardarEmpresa'],
  ['POST', '/api/fel', 'guardarDatosFiscales'],
  ['POST', '/api/pos/ventas', 'registrarVentaPos + certificar + registrarCobro'],
  ['POST', '/api/socios', 'guardarSocio'],
  ['POST', '/api/sucursales', 'guardarSucursal'],
  ['POST', '/api/series', 'guardarSerie'],
  ['POST', '/api/roles', 'guardarRol'],
  ['POST', '/api/usuarios', 'guardarUsuario'],
  ['POST', '/api/ordenes-venta', 'crearOrdenVenta'],
  ['POST', '/api/ordenes-compra', 'crearOrdenCompra'],
  ['POST', '/api/ordenes-compra/:id/recibir', 'recibirOrdenCompra'],
  ['POST', '/api/ordenes-compra/:id/pagos', 'pagarProveedor'],
  ['POST', '/api/bancos', 'guardarCuentaBancaria'],
  ['POST', '/api/facturas', 'emitirFactura / emitirNotaCredito / emitirNotaDebito'],
  ['POST', '/api/facturas/:id/cancelar', 'cancelarDocumento si está abierta; anularConCertificador si está cerrada'],
  ['POST', '/api/facturas/:id/certificar', 'armarDte + certificador + aplicarCertificacion'],
  ['POST', '/api/facturas/:id/cobros', 'registrarCobro'],
  ['POST', '/api/rutas', 'crearRuta'],
  ['POST', '/api/rutas/:id/iniciar', 'iniciarRuta'],
  ['POST', '/api/rutas/:id/paradas/:paradaId', 'marcarParada'],
  ['POST', '/api/asientos', 'asientoManual'],
] as const
